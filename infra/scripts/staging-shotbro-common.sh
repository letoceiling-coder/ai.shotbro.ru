#!/usr/bin/env bash
# Shared Shotbro staging deploy / image retention helpers (source, do not execute).
set -euo pipefail

SHOTBRO_SRC="${SHOTBRO_SRC:-/var/www/ai.shotbro.ru-src}"
SHOTBRO_DEPLOY_DIR="${SHOTBRO_DEPLOY_DIR:-${SHOTBRO_SRC}/.deploy}"
SHOTBRO_STATE_FILE="${SHOTBRO_STATE_FILE:-${SHOTBRO_DEPLOY_DIR}/state.env}"
SHOTBRO_DOCKER_LOCK="${SHOTBRO_DOCKER_LOCK:-/var/lock/shotbro-docker.lock}"

shotbro_log() { echo "[shotbro] $*"; }
shotbro_fail() { shotbro_log "ERROR: $*"; exit 1; }

shotbro_ensure_docker_lock_dir() {
  mkdir -p "$(dirname "$SHOTBRO_DOCKER_LOCK")"
}

# Serialize docker build / GC on shared storage (legacy builder drops intermediate stages under races).
shotbro_with_docker_lock() {
  shotbro_ensure_docker_lock_dir
  local lock_fd
  exec {lock_fd}>"$SHOTBRO_DOCKER_LOCK"
  if ! flock -x "$lock_fd"; then
    shotbro_fail "docker_lock_unavailable ${SHOTBRO_DOCKER_LOCK}"
  fi
  "$@"
  flock -u "$lock_fd"
  exec {lock_fd}>&-
}

shotbro_try_docker_lock() {
  shotbro_ensure_docker_lock_dir
  local lock_fd
  exec {lock_fd}>"$SHOTBRO_DOCKER_LOCK"
  if ! flock -n "$lock_fd"; then
    exec {lock_fd}>&-
    return 1
  fi
  "$@"
  local rc=$?
  flock -u "$lock_fd"
  exec {lock_fd}>&-
  return "$rc"
}

shotbro_docker_build() {
  if docker buildx version >/dev/null 2>&1; then
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
  else
    export DOCKER_BUILDKIT=0
    shotbro_log "buildkit_unavailable using_legacy_builder_with_flock"
  fi
  shotbro_with_docker_lock docker build "$@"
}

shotbro_ensure_deploy_dir() {
  mkdir -p "$SHOTBRO_DEPLOY_DIR"
}

shotbro_image_id() {
  docker image inspect "$1" --format '{{.Id}}' 2>/dev/null || true
}

shotbro_disk_preflight() {
  local min_free_gb="${1:-8}"
  local build_peak_gb="${2:-10}"
  local block_pct="${DISK_BLOCK_USED_PCT:-90}"
  local avail_kb avail_gb used_pct need_gb
  avail_kb=$(df -Pk / | awk 'NR==2 {print $4}')
  avail_gb=$((avail_kb / 1024 / 1024))
  used_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
  need_gb=$((min_free_gb + build_peak_gb))
  if [ "$used_pct" -ge "$block_pct" ]; then
    shotbro_fail "BLOCKED_DISK_CAPACITY used=${used_pct}% (>=${block_pct}%)"
  fi
  if [ "$avail_gb" -lt "$need_gb" ]; then
    shotbro_fail "BLOCKED_DISK_CAPACITY free=${avail_gb}GB need>=${need_gb}GB"
  fi
  shotbro_log "disk_ok free_gb=${avail_gb} used_pct=${used_pct} need_gb=${need_gb}"
}

# Promote build tag -> :current, previous :current -> :rollback (one rollback max).
shotbro_promote_image() {
  local repo="$1"
  local build_ref="$2"
  local current="${repo}:current"
  local rollback="${repo}:rollback"

  docker image inspect "$build_ref" >/dev/null 2>&1 || shotbro_fail "missing build image ${build_ref}"

  local new_id cur_id rb_id
  new_id=$(shotbro_image_id "$build_ref")
  cur_id=$(shotbro_image_id "$current")
  rb_id=$(shotbro_image_id "$rollback")

  if [ -n "$cur_id" ] && [ "$cur_id" != "$new_id" ]; then
    docker tag "$current" "$rollback" 2>/dev/null || docker tag "$cur_id" "$rollback"
    shotbro_log "rollback_saved ${rollback}<=${cur_id}"
    if [ -n "$rb_id" ] && [ "$rb_id" != "$cur_id" ] && [ "$rb_id" != "$new_id" ]; then
      if ! docker ps -a --filter "ancestor=${rb_id}" --format '{{.ID}}' | grep -q .; then
        docker rmi "$rb_id" 2>/dev/null || true
      fi
    fi
  fi

  docker tag "$build_ref" "$current"
  docker rmi "$build_ref" 2>/dev/null || true
  shotbro_log "promoted ${current}=${new_id}"
}

# Collect image IDs that must never be removed by Shotbro GC.
shotbro_protected_image_ids() {
  local ids=()
  local ref id name
  for ref in \
    shotbro/web:current shotbro/web:rollback \
    shotbro/api:current shotbro/api:rollback \
    shotbro/worker:current shotbro/worker:rollback \
    infra-web:deployed infra-web:rollback; do
    id=$(shotbro_image_id "$ref")
    [ -n "$id" ] && ids+=("$id")
  done
  for name in infra-web-1 ai-shotbro-staging-api-1 ai-shotbro-staging-worker-1; do
    id=$(docker inspect "$name" --format '{{.Image}}' 2>/dev/null || true)
    [ -n "$id" ] && ids+=("$id")
  done
  printf '%s\n' "${ids[@]}" | sort -u
}

shotbro_is_protected_id() {
  local target="$1"
  local id
  while read -r id; do
    [ "$id" = "$target" ] && return 0
  done < <(shotbro_protected_image_ids)
  return 1
}

# Remove Shotbro-specific historical tags / unused IDs only.
shotbro_gc_images() {
  if ! shotbro_try_docker_lock _shotbro_gc_images_inner; then
    shotbro_log "gc_skipped docker_build_or_gc_in_progress"
    return 0
  fi
}

_shotbro_gc_images_inner() {
  local repo tag id
  shotbro_log "gc_start"
  docker image prune -f >/dev/null 2>&1 || true

  while read -r repo tag; do
    [ "$repo" = "shotbro-web-build" ] || continue
    id=$(docker image inspect "${repo}:${tag}" --format '{{.Id}}' 2>/dev/null || true)
    [ -z "$id" ] && continue
    if shotbro_is_protected_id "$id"; then
      docker rmi "${repo}:${tag}" 2>/dev/null && shotbro_log "gc_untag_legacy ${repo}:${tag}" || shotbro_log "gc_keep_id ${id}"
    else
      docker rmi "${repo}:${tag}" 2>/dev/null && shotbro_log "gc_rmi ${repo}:${tag}" || true
    fi
  done < <(docker images shotbro-web-build --format '{{.Repository}} {{.Tag}}' 2>/dev/null || true)

  local keep_bytes=$(( ${BUILD_CACHE_KEEP_GB:-8} * 1024 * 1024 * 1024 ))
  docker builder prune -f --keep-storage "$keep_bytes" >/dev/null 2>&1 || true
  shotbro_log "gc_done"
}

shotbro_record_deploy() {
  local service="$1"
  local sha="$2"
  local image_ref="$3"
  shotbro_ensure_deploy_dir
  local id upper
  upper=$(echo "$service" | tr '[:lower:]' '[:upper:]')
  id=$(shotbro_image_id "$image_ref")
  {
    echo "DEPLOYED_${upper}_SHA=${sha}"
    echo "DEPLOYED_${upper}_AT=$(date -Is)"
    echo "DEPLOYED_${upper}_IMAGE=${image_ref}"
    echo "DEPLOYED_${upper}_ID=${id}"
  } >> "$SHOTBRO_STATE_FILE"
  echo "${service}_sha=${sha} ${service}_image=${id}" >> "${SHOTBRO_SRC}/DEPLOYED.txt"
}

shotbro_git_head_sha() {
  local src="${1:-$SHOTBRO_SRC}"
  git -C "$src" rev-parse --short HEAD
}

shotbro_services_changed_since_deploy() {
  local src="${1:-$SHOTBRO_SRC}"
  local base="${2:-}"
  if [ -z "$base" ] && [ -f "${SHOTBRO_DEPLOY_DIR}/last-deploy-sha" ]; then
    base=$(cat "${SHOTBRO_DEPLOY_DIR}/last-deploy-sha")
  fi
  if [ -z "$base" ]; then
    echo "web api worker"
    return
  fi
  local files changed=()
  files=$(git -C "$src" diff --name-only "$base" HEAD 2>/dev/null || true)
  if echo "$files" | grep -qE '^(apps/web/|packages/.|pnpm-lock|infra/Dockerfile.web)'; then
    changed+=("web")
  fi
  if echo "$files" | grep -qE '^(apps/api/|packages/.|pnpm-lock|infra/Dockerfile.api)'; then
    changed+=("api")
  fi
  if echo "$files" | grep -qE '^(apps/worker/|packages/.|pnpm-lock|infra/Dockerfile.worker)'; then
    changed+=("worker")
  fi
  if [ "${#changed[@]}" -eq 0 ]; then
    echo ""
  else
    printf '%s\n' "${changed[@]}" | sort -u | tr '\n' ' '
  fi
}
