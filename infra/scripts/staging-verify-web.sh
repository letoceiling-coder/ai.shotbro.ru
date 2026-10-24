#!/usr/bin/env bash
# Read-only deployment validation for ai.shotbro.ru web (no secrets).
set -euo pipefail
SRC="${1:-/var/www/ai.shotbro.ru-src}"
EXPECTED_SHA="${2:-}"

echo "=== nginx listener ==="
ss -tlnp | grep ':3020' || { echo "FAIL: nothing on 3020"; exit 1; }

echo "=== compose web container ==="
docker ps --filter name=infra-web-1 --format 'name={{.Names}} status={{.Status}} image_id={{.Image}}'

if ! docker ps --filter name=infra-web-1 --filter status=running -q | grep -q .; then
  echo "FAIL: infra-web-1 not running"
  exit 1
fi

echo "=== systemd (must not compete) ==="
systemctl is-active ai-shotbro-web.service 2>/dev/null || echo "systemd inactive (ok)"
systemctl is-enabled ai-shotbro-web.service 2>/dev/null || true

echo "=== health ==="
curl -sf "http://127.0.0.1:3020/" >/dev/null && echo "local_3020=ok"
curl -sf "https://ai.shotbro.ru/" >/dev/null && echo "public_https=ok"

if [ -n "$EXPECTED_SHA" ] && [ -f "${SRC}/.deployed-web-image" ]; then
  echo "=== image tag file ==="
  cat "${SRC}/.deployed-web-image"
fi

if docker image inspect infra-web:deployed >/dev/null 2>&1; then
  echo "=== build label ==="
  docker image inspect infra-web:deployed --format 'label_sha={{index .Config.Labels "org.shotbro.build-sha"}} id={{.Id}}'
fi

tail -1 "${SRC}/DEPLOYED.txt" 2>/dev/null || true
df -h / | tail -1
echo "verify_ok"
