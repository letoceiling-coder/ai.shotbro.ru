#!/usr/bin/env sh
set -e
export DATABASE_URL="${DATABASE_URL:-postgresql://shotbro:shotbro_test@127.0.0.1:5433/shotbro_test}"
cd "$(dirname "$0")/../packages/db"
pnpm exec drizzle-kit migrate
