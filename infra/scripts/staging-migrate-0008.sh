#!/usr/bin/env bash
# Phase 6E: add SCENE_CANVAS to production_doc_type (additive). Back up the DB first.
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SQL="$ROOT/packages/db/drizzle/migrations/0008_scene_canvas.sql"
cd "$ROOT/infra"
docker compose --env-file staging.env -f docker-compose.staging.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U shotbro_staging -d shotbro_staging -f - < "$SQL"
echo "0008 scene canvas applied"
