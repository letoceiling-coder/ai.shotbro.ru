#!/usr/bin/env bash
set -euo pipefail
NET="${COMPOSE_NETWORK:-ai-shotbro-staging_staging_internal}"
PG_CONTAINER="${PG_CONTAINER:-shotbro-budget-test-pg}"
API_CONTAINER="${API_CONTAINER:-ai-shotbro-staging-api-1}"

if ! docker inspect "$PG_CONTAINER" >/dev/null 2>&1; then
  docker run -d --name "$PG_CONTAINER" --network "$NET" \
    -e POSTGRES_USER=shotbro -e POSTGRES_PASSWORD=shotbro_test -e POSTGRES_DB=shotbro_test \
    postgres:16-alpine
  sleep 4
else
  docker network connect "$NET" "$PG_CONTAINER" 2>/dev/null || true
fi

DB_URL="postgresql://shotbro:shotbro_test@${PG_CONTAINER}:5432/shotbro_test"

docker exec -w /app/packages/db -e DATABASE_URL="$DB_URL" "$API_CONTAINER" pnpm exec drizzle-kit migrate
docker exec -w /app/apps/api -e DATABASE_URL="$DB_URL" -e RUN_DB_INTEGRATION_TESTS=1 "$API_CONTAINER" \
  pnpm exec vitest run --config vitest.integration.config.ts test/db/cost-reservation.db.integration.spec.ts
