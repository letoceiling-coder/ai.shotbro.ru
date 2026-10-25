#!/usr/bin/env bash
set -euo pipefail
SHA="${1:?full or short commit sha}"
ROOT="${2:-/var/www/ai.shotbro.ru-src}"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging
echo "DEPLOYED=${SHA}" > "$ROOT/DEPLOYED.txt"
bash "$(dirname "$0")/staging-deploy-staging-stack.sh" api "$SHA" "$ROOT"
bash "$(dirname "$0")/staging-deploy-staging-stack.sh" worker "$SHA" "$ROOT"
curl -sf http://127.0.0.1:3021/api/v1/health/live
echo " deploy_ok sha=${SHA}"
