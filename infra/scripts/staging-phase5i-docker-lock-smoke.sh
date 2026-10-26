#!/usr/bin/env bash
# Verify docker build/GC lock without a full image rebuild.
set -euo pipefail
DIR="$(dirname "$0")"
# shellcheck source=staging-shotbro-common.sh
source "${DIR}/staging-shotbro-common.sh"

shotbro_log "lock_smoke_start"
shotbro_with_docker_lock sleep 0.2
(
  shotbro_with_docker_lock sleep 2 &
  pid=$!
  sleep 0.3
  if shotbro_try_docker_lock sleep 0.1; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    shotbro_fail "lock_smoke_concurrent_allowed (expected skip)"
  fi
  wait "$pid" || true
  shotbro_log "lock_smoke_concurrent_blocked_ok"
)

shotbro_log "lock_smoke_pass"
