#!/usr/bin/env bash
# Allowlisted cleanup for Shotbro staging — dry-run by default.
# Usage:
#   staging-safe-cleanup.sh              # dry-run
#   staging-safe-cleanup.sh --confirm    # execute
# Env:
#   KEEP_WEB_TAGS="015cbb7 3240e70 ed85a6a"  (space-separated rollback tags)
#   BUILD_CACHE_KEEP_GB=12
#   STANDALONE_BAK_KEEP=2
set -euo pipefail

CONFIRM=0
if [ "${1:-}" = "--confirm" ]; then
  CONFIRM=1
fi

SRC="${SHOTBRO_SRC:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${SHOTBRO_WEB_ROOT:-/var/www/ai.shotbro.ru}"
LOG="/var/log/shotbro-cleanup-$(date +%Y%m%d%H%M%S).log"
KEEP_WEB_TAGS="${KEEP_WEB_TAGS:-015cbb7 3240e70 ed85a6a}"
BUILD_CACHE_KEEP_GB="${BUILD_CACHE_KEEP_GB:-12}"
STANDALONE_BAK_KEEP="${STANDALONE_BAK_KEEP:-2}"
E2E_LOG_KEEP_DAYS="${E2E_LOG_KEEP_DAYS:-14}"

exec > >(tee -a "$LOG") 2>&1

log() { echo "[staging-safe-cleanup] $*"; }
run() {
  if [ "$CONFIRM" -eq 1 ]; then
    log "EXEC: $*"
    eval "$@"
  else
    log "DRY-RUN: $*"
  fi
}

before_free=$(df -Pk / | awk 'NR==2 {print $4}')
log "start confirm=${CONFIRM} free_kb=${before_free}"

is_protected_web_tag() {
  local tag="$1"
  for k in $KEEP_WEB_TAGS; do
    [ "$tag" = "$k" ] && return 0
  done
  return 1
}

section_shotbro_images() {
  log "--- shotbro-web-build tags ---"
  while read -r repo tag id rest; do
    [ "$repo" = "shotbro-web-build" ] || continue
    if is_protected_web_tag "$tag"; then
      log "KEEP image ${repo}:${tag}"
    else
      run "docker rmi ${repo}:${tag} 2>/dev/null || true"
    fi
  done < <(docker images shotbro-web-build --format '{{.Repository}} {{.Tag}} {{.ID}}' 2>/dev/null || true)

  log "--- dangling builder intermediates (<none>) ---"
  run "docker image prune -f"
}

section_build_cache() {
  local keep_bytes=$((BUILD_CACHE_KEEP_GB * 1024 * 1024 * 1024))
  log "--- build cache prune keep_storage=${BUILD_CACHE_KEEP_GB}GB ---"
  run "docker builder prune -f --keep-storage ${keep_bytes}"
}

section_standalone_bak() {
  log "--- standalone.bak retention keep=${STANDALONE_BAK_KEEP} ---"
  mapfile -t baks < <(ls -1dt "$WEB_ROOT"/standalone.bak-* 2>/dev/null || true)
  local i=0
  for d in "${baks[@]}"; do
    i=$((i + 1))
    if [ "$i" -le "$STANDALONE_BAK_KEEP" ]; then
      log "KEEP $d"
    else
      run "rm -rf $(printf %q "$d")"
    fi
  done
}

section_e2e_logs() {
  log "--- e2e logs older than ${E2E_LOG_KEEP_DAYS}d (keep recent acceptance) ---"
  if [ -d /var/log/shotbro-e2e ]; then
    run "find /var/log/shotbro-e2e -type f -name '*.log' -mtime +${E2E_LOG_KEEP_DAYS} -print"
    if [ "$CONFIRM" -eq 1 ]; then
      find /var/log/shotbro-e2e -type f -name '*.log' -mtime +"${E2E_LOG_KEEP_DAYS}" -delete 2>/dev/null || true
    fi
  fi
}

section_playwright_artifacts() {
  log "--- playwright test-results (not failed traces from last 7d) ---"
  local tr="${SRC}/apps/web/test-results"
  if [ -d "$tr" ]; then
    run "find $(printf %q "$tr") -type f -mtime +7 ! -name 'trace.zip' -print 2>/dev/null | head -50"
    if [ "$CONFIRM" -eq 1 ]; then
      find "$tr" -type f -mtime +7 ! -name 'trace.zip' -delete 2>/dev/null || true
    fi
  fi
}

section_shotbro_images
section_build_cache
section_standalone_bak
section_e2e_logs
section_playwright_artifacts

after_free=$(df -Pk / | awk 'NR==2 {print $4}')
freed_kb=$((after_free - before_free))
log "end free_kb=${after_free} delta_kb=${freed_kb} log=${LOG}"
docker system df 2>/dev/null | head -5 || true

if [ "$CONFIRM" -eq 0 ]; then
  log "No changes made. Re-run with --confirm to apply."
fi
