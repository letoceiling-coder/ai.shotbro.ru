# Phase 3 — Staging DB migration (2026-10-24)

## Pre-check

- Disk: `/dev/vda1` ~25G free (~79% used) on VPS `85.117.235.93`.
- Containers: `ai-shotbro-staging-postgres-1` healthy; api/worker/redis/minio up.

## Backup (2026-10-23 22:36 UTC)

```text
/var/backups/shotbro-staging-phase3-20261023-2236/pg.sql.gz  (~78 KB compressed)
```

**Restore test:** `staging-restore-test.sh` → isolated DB `shotbro_staging_restore_test_*`, **83 projects**, then dropped. **PASS**

**Rollback (live DB only):** `gunzip -c pg.sql.gz | docker exec -i ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging`

## Applied SQL history

| Tag | Applied | Method |
|-----|---------|--------|
| `0000_hesitant_the_order` | yes | Drizzle journal id=1 |
| `0001_third_tigra` | yes | manual psql (prior session) |
| `0002_square_makkari` | yes | manual psql (prior session) |
| `0003_production_approval_state` | yes | `ALTER TYPE … ADD VALUE 'WAITING_PRODUCTION_APPROVAL'` + journal row |

## Drizzle journal reconciliation

Before `0003`, journal had **only** `0000` hash. Backfilled `0001`/`0002` hashes (no SQL re-run) via `infra/scripts/backfill-drizzle-journal.sql`, then inserted `0003` hash:

```text
7892b53f… 0000
f24b49c2… 0001
ae9ae230… 0002
bcc9f9b4… 0003
```

**Verification:** `WAITING_PRODUCTION_APPROVAL` present in `agent_production_state`; project count **83** unchanged.

## Deploy marker

`/var/www/ai.shotbro.ru-src/DEPLOYED.txt` → `DEPLOYED=6dcc810`
