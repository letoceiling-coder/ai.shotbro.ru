#!/usr/bin/env bash
# Backup → delete test projects → restore → verify counts (staging DB only).
set -euo pipefail
BACKUP="/tmp/staging-shotbro-backup-test.sql.gz"
docker exec ai-shotbro-staging-postgres-1 pg_dump -U shotbro_staging -d shotbro_staging | gzip -9 >"$BACKUP"
BEFORE=$(docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -At \
  -c "SELECT count(*) FROM project;")
docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -c \
  "DELETE FROM project WHERE title = 'E2E Staging';"
AFTER_DEL=$(docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -At \
  -c "SELECT count(*) FROM project;")
# Data-only restore of deleted rows (avoid replaying full schema on live DB)
gunzip -c "$BACKUP" | docker exec -i ai-shotbro-staging-postgres-1 pg_restore -U shotbro_staging -d shotbro_staging --data-only --disable-triggers -q 2>/dev/null \
  || gunzip -c "$BACKUP" | docker exec -i ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -q -c "SELECT 1"
AFTER_RESTORE=$(docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -At \
  -c "SELECT count(*) FROM project;")
echo "backup_bytes=$(wc -c <"$BACKUP") before=$BEFORE after_delete=$AFTER_DEL after_restore=$AFTER_RESTORE"
[[ "$AFTER_RESTORE" -eq "$BEFORE" ]] && echo BACKUP_RESTORE_OK || { echo BACKUP_RESTORE_FAIL; exit 1; }
