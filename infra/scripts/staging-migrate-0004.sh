#!/usr/bin/env bash
set -euo pipefail
cd /var/www/ai.shotbro.ru-src/infra
docker compose --env-file staging.env -f docker-compose.staging.yml exec -T postgres \
  psql -U shotbro_staging -d shotbro_staging -f - <<'SQL'
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp with time zone;
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;
SQL
echo "0004 admin fields applied"
