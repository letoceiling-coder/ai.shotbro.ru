#!/usr/bin/env bash
# Rebuild DEMO+REAL web on 127.0.0.1:3020 (infra-web-1). Does not touch studio stacks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://ai.shotbro.ru}"
docker compose build web
docker compose up -d web
curl -sf -o /dev/null -w "web HTTP %{http_code}\n" "http://127.0.0.1:3020/studio" || true
