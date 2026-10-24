#!/usr/bin/env bash
set -euo pipefail
# Build Next.js standalone on VPS source tree and swap into systemd web root.
SHA="${1:?commit sha}"
SRC="${2:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${3:-/var/www/ai.shotbro.ru}"
BACKUP="${WEB_ROOT}/standalone.bak-$(date +%Y%m%d%H%M%S)"

echo "DEPLOYED_WEB=${SHA}" >> "$SRC/DEPLOYED.txt"

cd "$SRC"
pnpm config set verify-deps-before-run false
pnpm config set strict-dep-builds false
pnpm install
pnpm --filter web typecheck
pnpm --filter web build

NEW_STANDALONE="$SRC/apps/web/.next/standalone"
test -f "$NEW_STANDALONE/apps/web/server.js"

if [ -d "$WEB_ROOT/standalone" ]; then
  cp -a "$WEB_ROOT/standalone" "$BACKUP"
fi
rm -rf "$WEB_ROOT/standalone"
cp -a "$NEW_STANDALONE" "$WEB_ROOT/standalone"
rm -rf "$WEB_ROOT/static"
cp -a "$SRC/apps/web/.next/static" "$WEB_ROOT/static"

systemctl restart ai-shotbro-web.service
sleep 3
curl -sf "http://127.0.0.1:3020/" >/dev/null
echo "web_deploy_ok sha=${SHA} backup=${BACKUP}"
