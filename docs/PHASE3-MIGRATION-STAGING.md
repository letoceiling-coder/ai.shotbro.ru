# Phase 3 — Staging DB migration (2026-10-24)

## Pre-check

- Disk: `/dev/vda1` ~24G free (80% used) on VPS.
- Containers: `ai-shotbro-staging-postgres-1` healthy, API/worker/redis/minio up.

## Backup

```text
/var/backups/shotbro-staging-phase3-20261024/pg.sql.gz  (~76 KB compressed)
```

**Rollback:** `gunzip -c pg.sql.gz | docker exec -i ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging`

## Applied SQL

1. `/tmp/0001_third_tigra.sql` — production enums/tables, `agent_run.production_state`
2. `/tmp/0002_square_makkari.sql` — budget, ledger, prompt_version, tool_execution columns

## Verification

- `project` count: **83** (unchanged)
- `production_document` table present after 0001

## Note

Drizzle journal on server not updated (tarball deploy pending). Migrations applied manually via `psql`. Next full deploy should sync `drizzle/migrations/meta` and use `migrate` service for future tags.
