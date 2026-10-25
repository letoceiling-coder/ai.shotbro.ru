#!/usr/bin/env bash
# Allowlisted cleanup — dry-run by default. Never touches co-tenant images/volumes.
# Usage: staging-safe-cleanup.sh [--confirm]
set -euo pipefail

CONFIRM=0
[ "${1:-}" = "--confirm" ] && CONFIRM=1

SRC="${SHOTBRO_SRC:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${SHOTBRO_WEB_ROOT:-/var/www/ai.shotbro.ru}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

LOG="/var/log/shotbro-cleanup-$(date +%Y%m%d%H%M%S).log"
E2E_LOG_KEEP_DAYS="${E2E_LOG_KEEP_DAYS:-14}"
PW_RESULTS_KEEP_DAYS="${PW_RESULTS_KEEP_DAYS:-7}"

exec > >(tee -a "$LOG") 2>&1

log() { shotbro_log "safe-cleanup $*"; }
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

section_e2e_logs() {
  log "--- e2e logs older than ${E2E_LOG_KEEP_DAYS}d ---"
  [ -d /var/log/shotbro-e2e ] || return 0
  run "find /var/log/shotbro-e2e -type f -name '*.log' -mtime +${E2E_LOG_KEEP_DAYS} -print"
  if [ "$CONFIRM" -eq 1 ]; then
    find /var/log/shotbro-e2e -type f -name '*.log' -mtime +"${E2E_LOG_KEEP_DAYS}" -delete 2>/dev/null || true
  fi
}

section_playwright_artifacts() {
  log "--- playwright test-results older than ${PW_RESULTS_KEEP_DAYS}d (keep recent trace.zip on failures) ---"
  local tr="${SRC}/apps/web/test-results"
  [ -d "$tr" ] || return 0
  run "find $(printf %q "$tr") -type f -mtime +${PW_RESULTS_KEEP_DAYS} ! -name 'trace.zip' -print 2>/dev/null | head -40"
  if [ "$CONFIRM" -eq 1 ]; then
    find "$tr" -type f -mtime +"${PW_RESULTS_KEEP_DAYS}" ! -name 'trace.zip' -delete 2>/dev/null || true
  fi
}

section_legacy_standalone() {
  log "--- legacy standalone.bak (runtime is Docker-only) ---"
  run "find $(printf %q "$WEB_ROOT") -maxdepth 1 -type d -name 'standalone.bak-*' -print"
  if [ "$CONFIRM" -eq 1 ]; then
    find "$WEB_ROOT" -maxdepth 1 -type d -name 'standalone.bak-*' -exec rm -rf {} + 2>/dev/null || true
  fi
}

section_shotbro_gc() {
  log "--- shotbro image GC (current+rollback only) ---"
  if [ "$CONFIRM" -eq 1 ]; then
    shotbro_gc_images
  else
    log "DRY-RUN: shotbro_gc_images"
    docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '^shotbro/|^shotbro-web-build' || true
  fi
}

section_e2e_logs
section_playwright_artifacts
section_legacy_standalone
section_shotbro_gc

after_free=$(df -Pk / | awk 'NR==2 {print $4}')
log "end free_kb=${after_free} delta_kb=$((after_free - before_free)) log=${LOG}"
[ "$CONFIRM" -eq 0 ] && log "Re-run with --confirm to apply."
