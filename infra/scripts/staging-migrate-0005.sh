#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SQL="$ROOT/packages/db/drizzle/migrations/0005_provider_jobs.sql"
cd "$ROOT/infra"
docker compose --env-file staging.env -f docker-compose.staging.yml exec -T postgres \
  psql -U shotbro_staging -d shotbro_staging -f - < "$SQL"
echo "0005 provider jobs applied"
