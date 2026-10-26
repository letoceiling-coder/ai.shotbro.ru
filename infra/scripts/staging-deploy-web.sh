#!/usr/bin/env bash
# Web deploy: shotbro/web:current + :rollback only (no standalone backups).
set -euo pipefail

SHA="${1:?commit sha (short or full)}"
SRC="${2:-/var/www/ai.shotbro.ru-src}"
COMPOSE_DIR="${SRC}/infra"
BUILD_REF="shotbro/web:build"
CURRENT="shotbro/web:current"
WEB_IMAGE="${CURRENT}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

log() { shotbro_log "deploy-web $*"; }
fail() { shotbro_fail "$*"; }

rollback() {
  if docker image inspect shotbro/web:rollback >/dev/null 2>&1; then
    log "rolling back to shotbro/web:rollback"
    export WEB_IMAGE="shotbro/web:rollback"
    cd "$COMPOSE_DIR"
    docker compose up -d --no-build --force-recreate web || true
  fi
}

trap 'if [ "${DEPLOY_OK:-0}" != 1 ]; then rollback; fi' ERR

[ -d "$SRC" ] || fail "missing source tree ${SRC}"
[ -f "${COMPOSE_DIR}/docker-compose.yml" ] || fail "missing compose file"

shotbro_disk_preflight "${MIN_FREE_GB:-8}" "${WEB_BUILD_PEAK_GB:-10}"

systemctl stop ai-shotbro-web.service 2>/dev/null || true
systemctl disable ai-shotbro-web.service 2>/dev/null || true

cd "$COMPOSE_DIR"
log "building ${BUILD_REF} sha=${SHA} buildkit=${DOCKER_BUILDKIT:-1}"
shotbro_docker_build -f Dockerfile.web --build-arg "BUILD_SHA=${SHA}" -t "$BUILD_REF" ..
shotbro_promote_image "shotbro/web" "$BUILD_REF"

docker tag "$CURRENT" infra-web:deployed 2>/dev/null || true
docker tag shotbro/web:rollback infra-web:rollback 2>/dev/null || true
# compat aliases only — retention policy uses shotbro/web:* IDs

export WEB_IMAGE="$CURRENT"
docker compose up -d --no-build --force-recreate web

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:3020/" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:3020/" >/dev/null || fail "local :3020 health failed"
curl -sf "https://ai.shotbro.ru/" >/dev/null || fail "public https health failed"

running_img=$(docker inspect infra-web-1 --format '{{.Image}}')
built_id=$(shotbro_image_id "$CURRENT")
if [ "$running_img" != "$built_id" ]; then
  fail "container image mismatch running=${running_img} built=${built_id}"
fi

label_sha=$(docker inspect "$CURRENT" --format '{{index .Config.Labels "org.shotbro.build-sha"}}')
log "container_ok label_build_sha=${label_sha:-unknown}"

shotbro_record_deploy "web" "$SHA" "$CURRENT"
DEPLOY_OK=1
trap - ERR

shotbro_gc_images
docker ps --filter name=infra-web-1 --format 'status={{.Status}} ports={{.Ports}}'
log "web_deploy_ok sha=${SHA} image=${CURRENT}"
