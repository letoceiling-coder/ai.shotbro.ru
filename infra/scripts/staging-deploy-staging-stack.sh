#!/usr/bin/env bash
# Deploy api and/or worker on ai-shotbro-staging compose (minimal image retention).
set -euo pipefail

SVC="${1:?api|worker}"
SHA="${2:?commit sha}"
ROOT="${3:-/var/www/ai.shotbro.ru-src}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

COMPOSE_DIR="${ROOT}/infra"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging
export DEPLOY_SHA="$SHA"

case "$SVC" in
  api)
    REPO="shotbro/api"
    DOCKERFILE="Dockerfile.api"
    PEAK_GB="${API_BUILD_PEAK_GB:-8}"
    ;;
  worker)
    REPO="shotbro/worker"
    DOCKERFILE="Dockerfile.worker"
    PEAK_GB="${WORKER_BUILD_PEAK_GB:-10}"
    ;;
  *) shotbro_fail "unknown service ${SVC}" ;;
esac

BUILD_REF="${REPO}:build"
CURRENT="${REPO}:current"

log() { shotbro_log "deploy-${SVC} $*"; }

disk_preflight() { shotbro_disk_preflight "${MIN_FREE_GB:-8}" "$PEAK_GB"; }

rollback() {
  if docker image inspect "${REPO}:rollback" >/dev/null 2>&1; then
    log "rollback_to=${REPO}:rollback"
    export "SHOTBRO_${SVC^^}_IMAGE=${REPO}:rollback"
    cd "$COMPOSE_DIR"
    docker compose --env-file staging.env -f docker-compose.staging.yml up -d --no-build "$SVC" || true
  fi
}

trap 'if [ "${DEPLOY_OK:-0}" != 1 ]; then rollback; fi' ERR

[ -f "${COMPOSE_DIR}/staging.env" ] || shotbro_fail "missing staging.env"
disk_preflight

cd "$COMPOSE_DIR"
log "build ${BUILD_REF} sha=${SHA} buildkit=${DOCKER_BUILDKIT:-1}"
shotbro_docker_build -f "$DOCKERFILE" --build-arg "BUILD_SHA=${SHA}" -t "$BUILD_REF" ..
shotbro_promote_image "$REPO" "$BUILD_REF"

if [ "$SVC" = "api" ]; then
  export SHOTBRO_API_IMAGE="$CURRENT"
else
  export SHOTBRO_WORKER_IMAGE="$CURRENT"
fi
docker compose --env-file staging.env -f docker-compose.staging.yml up -d --no-build "$SVC"

for _ in $(seq 1 20); do
  if curl -sf http://127.0.0.1:3021/api/v1/health/live >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -sf http://127.0.0.1:3021/api/v1/health/live >/dev/null || shotbro_fail "api health failed"

running=$(docker inspect "ai-shotbro-staging-${SVC}-1" --format '{{.Image}}')
built=$(shotbro_image_id "$CURRENT")
[ "$running" = "$built" ] || shotbro_fail "image mismatch running=${running} current=${built}"

shotbro_record_deploy "$SVC" "$SHA" "$CURRENT"
DEPLOY_OK=1
trap - ERR
shotbro_gc_images
log "ok image=${built}"
