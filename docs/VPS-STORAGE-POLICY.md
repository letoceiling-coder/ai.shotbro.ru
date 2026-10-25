# VPS storage policy — ai.shotbro.ru staging

## Thresholds

| Level | Filesystem used | Action |
|-------|-----------------|--------|
| OK | &lt; 75% | Normal deploys |
| WARNING | 75–84% | Run `staging-disk-audit.sh`; schedule `staging-safe-cleanup.sh --confirm` |
| CRITICAL | 85–89% | **No web/API rebuild** until cleanup; alert via cron |
| BLOCK | ≥ 90% | `staging-deploy-web.sh` exits **BLOCKED_DISK_CAPACITY** |

Deploy preflight requires:

`free_gb >= MIN_FREE_GB (8) + WEB_BUILD_PEAK_GB (10)` → **18GB** default free before web build.

## Retention (minimal deploy — see `SHOTBRO-MINIMAL-DEPLOYMENT.md`)

| Artifact | Policy |
|----------|--------|
| `shotbro/web\|api\|worker:current` | **1** active image ID per service |
| `shotbro/*:rollback` | **0–1** previous confirmed image ID |
| `shotbro-web-build:*` | **None** after deploy (GC removes stale SHA tags) |
| `infra-web:deployed` / `infra-web:rollback` | Aliases to web current/rollback (compat) |
| `standalone.bak-*` | **Removed** — no new copies on deploy |
| Dangling `<none>` images | Remove after each web deploy + weekly cleanup |
| BuildKit cache | `docker builder prune --keep-storage 8GB` after deploy/GC (see `VPS-SHARED-STORAGE-RECOVERY.md`) |
| `standalone.bak-*` | Keep **2** newest (`STANDALONE_BAK_KEEP`) |
| `/var/log/shotbro-e2e/*.log` | **14 days** |
| Playwright `test-results` on host | Files older than **7d** except recent traces (cleanup script) |
| Acceptance evidence | Keep logs referenced in `docs/PHASE5-*-ACCEPTANCE.md` |

## Docker logging

| Stack | Setting |
|-------|---------|
| `docker-compose.staging.yml` (api/worker) | json-file **30m × 4** |
| `docker-compose.yml` (web) | json-file **10m × 3** |

Recreate containers to apply new log options.

## Monitoring

Hourly: `staging-disk-alert.sh` → `/var/log/shotbro-disk-alert.log` + syslog `shotbro-disk`.

Weekly: `staging-disk-audit.sh` → `/var/log/shotbro-disk-audit-weekly.txt`.

Install on VPS:

```bash
cd /var/www/ai.shotbro.ru-src && git pull
bash infra/scripts/staging-install-disk-cron.sh
```

## Build optimization (2026-10-25)

- **`.dockerignore`**: exclude docs, e2e, tarballs, test artifacts, `staging.env`.  
- **`Dockerfile.web`**: deps stage with lockfile + `pnpm install --filter web...` before full `COPY`.  
- **Deploy**: post-build `docker image prune -f`; trim standalone backups.

## Explicitly forbidden (automated scripts)

- `docker volume prune`  
- `docker system prune -af --volumes`  
- `docker compose down -v`  
- Deleting `staging_pgdata` / `staging_minio` volumes  

## Co-tenant note

This VPS also runs Dify, parser RAG, `studio-shotbro`, and host Ollama. **~62GB** Docker image data is reclaimable globally but **not** in Shotbro allowlist. Plan separate maintenance with stack owners.
