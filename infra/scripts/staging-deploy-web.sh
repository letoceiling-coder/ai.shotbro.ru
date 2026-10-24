#!/usr/bin/env bash
set -euo pipefail
# Build web via Docker and roll out the container that owns 127.0.0.1:3020 (infra compose).
# Also snapshots standalone under WEB_ROOT for rollback; systemd unit is NOT started (EADDRINUSE with compose).
SHA="${1:?commit sha}"
SRC="${2:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${3:-/var/www/ai.shotbro.ru}"
BACKUP="${WEB_ROOT}/standalone.bak-$(date +%Y%m%d%H%M%S)"
IMAGE="shotbro-web-build:${SHA}"

echo "DEPLOYED_WEB=${SHA} at $(date -Is)" >> "$SRC/DEPLOYED.txt"

cd "$SRC/infra"
docker build -f Dockerfile.web -t "$IMAGE" ..
docker tag "$IMAGE" infra-web:deployed

CID=$(docker create "$IMAGE")
TMP=$(mktemp -d)
docker cp "$CID:/app/." "$TMP/standalone"
docker rm "$CID" >/dev/null

if [ -d "$WEB_ROOT/standalone" ]; then
  cp -a "$WEB_ROOT/standalone" "$BACKUP"
fi
rm -rf "$WEB_ROOT/standalone"
cp -a "$TMP/standalone" "$WEB_ROOT/standalone"
rm -rf "$TMP"

systemctl stop ai-shotbro-web.service 2>/dev/null || true

docker compose build web
docker compose up -d --force-recreate web
sleep 4
curl -sf "http://127.0.0.1:3020/" >/dev/null
docker ps --filter name=infra-web-1 --format 'running={{.Status}} image={{.Image}}'
echo "web_deploy_ok sha=${SHA} backup=${BACKUP} image=${IMAGE} listener=127.0.0.1:3020 via docker compose web"
