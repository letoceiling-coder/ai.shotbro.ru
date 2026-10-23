#!/usr/bin/env bash
# On VPS: /var/www/ai.shotbro.ru-src/scripts/vps-staging-up.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"
if [[ ! -f staging.env ]]; then
  bash "$ROOT/scripts/init-staging-env.sh" staging.env
fi
export COMPOSE_ENV_FILES=staging.env
docker compose --env-file staging.env -f docker-compose.staging.yml build api worker migrate
docker compose --env-file staging.env -f docker-compose.staging.yml up -d postgres redis minio
docker compose --env-file staging.env -f docker-compose.staging.yml run --rm migrate
docker compose --env-file staging.env -f docker-compose.staging.yml up -d api worker
curl -sf "http://127.0.0.1:3021/api/v1/health/live" && echo " api live"
