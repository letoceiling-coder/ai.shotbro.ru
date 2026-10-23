#!/usr/bin/env bash
set -euo pipefail
API="${API:-http://127.0.0.1:3021}"
CJ="$(mktemp)"
trap 'rm -f "$CJ"' EXIT

echo "== tables =="
docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -At \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;" | tee /tmp/staging-tables.txt
echo "count: $(wc -l < /tmp/staging-tables.txt)"

EMAIL="staging-$(date +%s)@test.local"
echo "== sign-up $EMAIL =="
curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"User A\"}" | head -c 500
echo

echo "== me =="
curl -sS -c "$CJ" -b "$CJ" "$API/api/v1/users/me" | head -c 500
echo

echo "== create project =="
curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/v1/projects" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E Staging","description":"test"}' | head -c 500
echo
