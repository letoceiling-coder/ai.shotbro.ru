#!/usr/bin/env bash
set -euo pipefail
# Build web via Docker (Node 22) and install standalone into systemd web root.
SHA="${1:?commit sha}"
SRC="${2:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${3:-/var/www/ai.shotbro.ru}"
BACKUP="${WEB_ROOT}/standalone.bak-$(date +%Y%m%d%H%M%S)"
IMAGE="shotbro-web-build:${SHA}"

echo "DEPLOYED_WEB=${SHA}" >> "$SRC/DEPLOYED.txt"

cd "$SRC/infra"
docker build -f Dockerfile.web -t "$IMAGE" ..
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

systemctl restart ai-shotbro-web.service
sleep 3
curl -sf "http://127.0.0.1:3020/" >/dev/null
echo "web_deploy_ok sha=${SHA} backup=${BACKUP} image=${IMAGE}"
