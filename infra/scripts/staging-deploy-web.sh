#!/usr/bin/env bash
# Single source of truth: docker compose web on 127.0.0.1:3020 (not systemd).
set -euo pipefail

SHA="${1:?commit sha (short or full)}"
SRC="${2:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${3:-/var/www/ai.shotbro.ru}"
COMPOSE_DIR="${SRC}/infra"
IMAGE="shotbro-web-build:${SHA}"
PREV_TAG_FILE="${SRC}/.deployed-web-image"
ROLLBACK_TAG="infra-web:rollback"
MIN_FREE_GB="${MIN_FREE_GB:-8}"

log() { echo "[staging-deploy-web] $*"; }
fail() { log "ERROR: $*"; exit 1; }

rollback() {
  if docker image inspect "$ROLLBACK_TAG" >/dev/null 2>&1; then
    log "Rolling back to ${ROLLBACK_TAG}"
    export WEB_IMAGE="$ROLLBACK_TAG"
    cd "$COMPOSE_DIR"
    docker compose up -d --force-recreate web || true
  else
    log "No rollback image tagged"
  fi
}

trap 'if [ "${DEPLOY_OK:-0}" != 1 ]; then rollback; fi' ERR

# --- preflight ---
[ -d "$SRC" ] || fail "missing source tree ${SRC}"
[ -f "${COMPOSE_DIR}/docker-compose.yml" ] || fail "missing compose file"

avail_kb=$(df -Pk / | awk 'NR==2 {print $4}')
avail_gb=$((avail_kb / 1024 / 1024))
if [ "$avail_gb" -lt "$MIN_FREE_GB" ]; then
  fail "disk low: ${avail_gb}GB free (need >= ${MIN_FREE_GB}GB)"
fi
log "disk_ok free_gb=${avail_gb}"

if docker ps --format '{{.Names}}' | grep -q '^infra-web-1$'; then
  cur_img=$(docker inspect infra-web-1 --format '{{.Config.Image}}')
  docker tag "$cur_img" "$ROLLBACK_TAG" 2>/dev/null || docker tag infra-web:latest "$ROLLBACK_TAG" 2>/dev/null || true
  log "rollback_tag_saved=${ROLLBACK_TAG} from=${cur_img}"
fi

systemctl stop ai-shotbro-web.service 2>/dev/null || true
systemctl disable ai-shotbro-web.service 2>/dev/null || true

# --- build ---
cd "$COMPOSE_DIR"
log "building image=${IMAGE}"
docker build -f Dockerfile.web --build-arg "BUILD_SHA=${SHA}" -t "$IMAGE" ..
docker tag "$IMAGE" infra-web:deployed

# standalone snapshot (rollback artifact, not runtime)
BACKUP="${WEB_ROOT}/standalone.bak-$(date +%Y%m%d%H%M%S)"
CID=$(docker create "$IMAGE")
TMP=$(mktemp -d)
docker cp "$CID:/app/." "$TMP/standalone"
docker rm "$CID" >/dev/null
if [ -d "$WEB_ROOT/standalone" ]; then cp -a "$WEB_ROOT/standalone" "$BACKUP"; fi
rm -rf "$WEB_ROOT/standalone"
cp -a "$TMP/standalone" "$WEB_ROOT/standalone"
rm -rf "$TMP"

# --- deploy compose web ---
export WEB_IMAGE="$IMAGE"
docker compose up -d --no-build --force-recreate web

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:3020/" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
curl -sf "http://127.0.0.1:3020/" >/dev/null || fail "local :3020 health failed"

if ! curl -sf "https://ai.shotbro.ru/" >/dev/null 2>&1; then
  fail "public https health failed"
fi

running_img=$(docker inspect infra-web-1 --format '{{.Image}}')
built_id=$(docker image inspect "$IMAGE" --format '{{.Id}}')
if [ "$running_img" != "$built_id" ]; then
  fail "container image mismatch running=${running_img} built=${built_id}"
fi

label_sha=$(docker inspect "$IMAGE" --format '{{index .Config.Labels "org.shotbro.build-sha"}}')
log "container_ok digest=${running_img} label_build_sha=${label_sha:-unknown}"

echo "DEPLOYED_WEB=${SHA} at $(date -Is) image=${IMAGE} digest=${running_img}" >> "${SRC}/DEPLOYED.txt"
echo "$IMAGE" > "$PREV_TAG_FILE"
DEPLOY_OK=1
trap - ERR

docker ps --filter name=infra-web-1 --format 'status={{.Status}} ports={{.Ports}}'
log "web_deploy_ok sha=${SHA} backup=${BACKUP} listener=127.0.0.1:3020"
