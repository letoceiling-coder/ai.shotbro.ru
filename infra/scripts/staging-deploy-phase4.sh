#!/usr/bin/env bash
set -euo pipefail
SHA="${1:?full or short commit sha}"
ROOT="${2:-/var/www/ai.shotbro.ru-src}"
cd "$ROOT/infra"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging
echo "DEPLOYED=${SHA}" > "$ROOT/DEPLOYED.txt"
docker compose --env-file staging.env -f docker-compose.staging.yml build api worker web
docker compose --env-file staging.env -f docker-compose.staging.yml up -d api worker web
curl -sf http://127.0.0.1:3021/api/v1/health/live
echo " deploy_ok sha=${SHA}"
