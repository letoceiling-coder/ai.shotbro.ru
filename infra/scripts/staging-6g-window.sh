#!/usr/bin/env bash
# Phase 6G live-test window: open | close | status. VPS only. Never prints secrets.
#   open   → recreate api+worker with docker-compose.staging.live6g.yml (live, caps $1/$3, ≤5 s)
#   close  → recreate api+worker with the normal staging compose (test mode, $0)
#   status → effective flags inside the running containers
set -euo pipefail
ROOT="${2:-/var/www/ai.shotbro.ru-src}"
cd "$ROOT/infra"
BASE=(docker compose --env-file staging.env -f docker-compose.staging.yml)
LIVE=(docker compose --env-file staging.env -f docker-compose.staging.yml -f docker-compose.staging.live6g.yml)
LOG=/var/log/shotbro-deploy/6g-window.log
mkdir -p "$(dirname "$LOG")"

flags() {
  for c in ai-shotbro-staging-api-1 ai-shotbro-staging-worker-1; do
    echo "== $c"
    docker exec "$c" sh -c 'for k in AI_MOCK_MODE PROVIDER_LIVE_EXECUTION_ENABLED CANVAS_LIVE_GENERATION_ENABLED CANVAS_LIVE_MAX_SECONDS ELEVENLABS_PROVIDER_ENABLED MEDIA_RUN_MAX_COST_USD MEDIA_USER_DAILY_MAX_USD MEDIA_GENERATION_ENABLED; do eval "v=\${$k:-<unset>}"; echo "  $k=$v"; done'
  done
}

wait_healthy() {
  for i in $(seq 1 40); do
    s=$(docker inspect -f '{{.State.Health.Status}}' ai-shotbro-staging-api-1 2>/dev/null || echo none)
    [ "$s" = healthy ] && return 0
    sleep 3
  done
  echo "api not healthy" >&2
  return 1
}

case "${1:-status}" in
  open)
    echo "6g_window_open $(date -Is)" | tee -a "$LOG"
    "${LIVE[@]}" up -d --no-deps --no-build api worker
    wait_healthy
    flags
    ;;
  close)
    echo "6g_window_close $(date -Is)" | tee -a "$LOG"
    "${BASE[@]}" up -d --no-deps --no-build api worker
    wait_healthy
    flags
    ;;
  status) flags ;;
  *) echo "usage: $0 open|close|status [ROOT]" >&2; exit 2 ;;
esac
