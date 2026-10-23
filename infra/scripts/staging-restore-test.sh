#!/bin/sh
set -e
BACKUP="${1:?backup path}"
TEST_DB=shotbro_staging_restore_test_$$
PGC="docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging"

$PGC -c "DROP DATABASE IF EXISTS ${TEST_DB};"
$PGC -c "CREATE DATABASE ${TEST_DB};"
gunzip -c "$BACKUP" | docker exec -i ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d "$TEST_DB" -v ON_ERROR_STOP=1 -q
echo "Restore test OK into ${TEST_DB}"
$PGC -d "$TEST_DB" -t -c "SELECT count(*) FROM project;"
$PGC -c "DROP DATABASE ${TEST_DB};"
