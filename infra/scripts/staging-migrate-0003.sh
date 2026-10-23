#!/bin/sh
set -e
PG="docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging"

echo "=== project count ==="
$PG -t -c "SELECT count(*) FROM project;"

echo "=== drizzle journal before ==="
$PG -c "SELECT id, left(hash,16) AS hash FROM drizzle.__drizzle_migrations ORDER BY id;"

echo "=== backfill 0001/0002 journal if missing ==="
$PG -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'f24b49c2fb85bc9f43aa6ee39c8daef33438368924b516cdbce4a392613b6cbf', 1792792599677
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'f24b49c2fb85bc9f43aa6ee39c8daef33438368924b516cdbce4a392613b6cbf'
);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT 'ae9ae23014fab550477c4808bfe931ed31fb1bac63affe50f3ece9ebf616154e', 1792793167320
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'ae9ae23014fab550477c4808bfe931ed31fb1bac63affe50f3ece9ebf616154e'
);
SQL

echo "=== apply 0003 if enum missing ==="
HAS=$($PG -t -A -c "SELECT count(*) FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='agent_production_state' AND e.enumlabel='WAITING_PRODUCTION_APPROVAL';")
if [ "$HAS" = "0" ]; then
  $PG -v ON_ERROR_STOP=1 -c "ALTER TYPE public.agent_production_state ADD VALUE IF NOT EXISTS 'WAITING_PRODUCTION_APPROVAL';"
  $PG -v ON_ERROR_STOP=1 -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) SELECT 'bcc9f9b46b981389173ef4bf4e326a40d9e64e368f5a34d11ef875ba3217205a', 1792800000000 WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = 'bcc9f9b46b981389173ef4bf4e326a40d9e64e368f5a34d11ef875ba3217205a');"
else
  echo "WAITING_PRODUCTION_APPROVAL already present"
fi

echo "=== drizzle journal after ==="
$PG -c "SELECT id, left(hash,16) AS hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id;"

echo "=== verify enum ==="
$PG -c "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='agent_production_state' AND e.enumlabel LIKE '%PRODUCTION%';"
