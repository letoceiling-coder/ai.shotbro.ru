#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${DB_TEST_CONTAINER:-shotbro-test-pg}"
PORT="${DB_TEST_PORT:-5433}"
DB_URL="postgresql://shotbro:shotbro_test@127.0.0.1:${PORT}/shotbro_test"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  docker run -d --name "$CONTAINER" -e POSTGRES_USER=shotbro -e POSTGRES_PASSWORD=shotbro_test \
    -e POSTGRES_DB=shotbro_test -p "${PORT}:5432" postgres:16-alpine
  sleep 4
fi

export DATABASE_URL="$DB_URL"
cd "$ROOT/packages/db"
pnpm exec drizzle-kit migrate
cd "$ROOT/apps/api"
export RUN_DB_INTEGRATION_TESTS=1
export INTEGRATION_DATABASE_URL="$DB_URL"
pnpm test:integration -- test/db/cost-reservation.db.integration.spec.ts
