# Shotbro minimal Docker deployment

**Branch:** `phase5/creative-studio`  
**VPS:** `85.117.235.93` / https://ai.shotbro.ru  

## Policy

| Rule | Value |
|------|--------|
| Tags per service | **`shotbro/<svc>:current`** + optional **`shotbro/<svc>:rollback`** |
| SHA tags | **Not retained** (`shotbro/web:build` is temporary during deploy) |
| Git | Source of truth; `.deploy/state.env` + `DEPLOYED.txt` record deployed SHAs |
| Standalone backups | **Disabled** (web runs in Docker only) |
| Co-tenant stacks | **Never** deleted by Shotbro scripts |

## Commands (VPS)

```bash
cd /var/www/ai.shotbro.ru-src
git pull

# One-time after upgrade:
bash infra/scripts/staging-shotbro-bootstrap-images.sh

# Deploy changed services only (default):
bash infra/scripts/staging-deploy.sh

# Explicit:
bash infra/scripts/staging-deploy.sh --service web <sha>
bash infra/scripts/staging-deploy.sh --service api <sha>
bash infra/scripts/staging-deploy.sh --service worker <sha>
bash infra/scripts/staging-deploy.sh --service all <sha>
bash infra/scripts/staging-deploy.sh --dry-run --service changed

# Verify health + protected image IDs:
bash infra/scripts/staging-deploy.sh --verify

# Safe cleanup (dry-run / confirm):
bash infra/scripts/staging-safe-cleanup.sh
bash infra/scripts/staging-safe-cleanup.sh --confirm

# Co-tenant report (read-only):
bash infra/scripts/staging-cotenant-docker-report.sh
```

## Disk preflight (web example)

- Block if used ≥ **90%**
- Require free ≥ **MIN_FREE_GB (8) + WEB_BUILD_PEAK_GB (10)** before web build
- On failure: **`BLOCKED_DISK_CAPACITY`** — run audit + safe cleanup

## E2E artifacts

- Playwright: `trace: retain-on-failure`, `screenshot: only-on-failure`, `video: off`
- Optional acceptance PNGs: **`E2E_ACCEPTANCE_SHOTS=1`** only for release evidence
- Runner: single **`mcr.microsoft.com/playwright:v1.64.1-jammy`**, reused **`shotbro-e2e-node-modules`** volume for pnpm store on host mount

## Rollback

```bash
export WEB_IMAGE=shotbro/web:rollback
cd infra && docker compose up -d --no-build --force-recreate web
# API/worker: set SHOTBRO_API_IMAGE / SHOTBRO_WORKER_IMAGE to :rollback and compose up
```

Git revert + redeploy builds a **new** image ID; `:rollback` tag is the fast container rollback.

## Files

| Script | Role |
|--------|------|
| `staging-deploy.sh` | Entry point |
| `staging-deploy-web.sh` | Web build/promote/GC |
| `staging-deploy-staging-stack.sh` | API/worker on `docker-compose.staging.yml` |
| `staging-shotbro-common.sh` | Promote, GC, disk checks |
| `staging-safe-cleanup.sh` | Allowlisted maintenance |
| `staging-disk-audit.sh` | Read-only metrics |

See also `docs/VPS-STORAGE-POLICY.md`, `docs/VPS-DISK-FORENSICS.md`.
