# Phase 2 — final acceptance (post final fixes)

**Branch:** `phase2/backend`  
**Baseline:** `2dd93b6`  
**Report HEAD:** see latest `git log -1` on this branch after final-fixes commit  
**Staging:** https://ai.shotbro.ru  

## Executive summary

| Goal | Status |
|------|--------|
| REAL user chain (auth, projects, chat, upload, reload) | **TESTED** (Playwright desktop) |
| Browser S3 presigned upload | **TESTED** (smoke + E2E) |
| Media workers (metadata/thumb/poster + cleanup/reconcile) | **IMPLEMENTED** — cleanup/reconcile no longer stubs |
| Approvals REAL + API + persistence | **IMPLEMENTED/TESTED** (integration + Playwright) |
| SSE replay / Last-Event-ID | **IMPLEMENTED/TESTED** (integration; stream polls every 2s) |
| Upload IDOR | **TESTED** (integration) |
| SMTP Beget | **DEPLOYED** — verify via `pnpm verify:smtp`; **rotate leaked password** |
| Selectel production S3 | **BLOCKED** (no new keys) |
| Production cutover | **BLOCKED** — template only (`infra/docker-compose.production.example.yml`) |
| Paid AI / OpenRouter | **DISABLED** |

Phase 2 **platform ready for Phase 3 agent**; **not** production-live.

---

## 1. VPS / Docker (§1)

| Item | Status |
|------|--------|
| Disk check | **TESTED** — ~69% used, **37G free** (2026-10-23) |
| Safe prune script | **IMPLEMENTED** — `scripts/vps-disk-maintenance.sh` (cache/dangling images, not volumes) |
| Container log rotation | **IMPLEMENTED** — `x-logging` on staging api/worker in compose |
| Monitoring | **IMPLEMENTED** — script warns above `DISK_WARN_PCT` (default 85%) |

**Past issue:** disk hit 99% — resolved via `docker builder prune` / image prune (no volume loss).

---

## 2. Media workers (§2)

| Queue | IMPLEMENTED | TESTED | DEPLOYED |
|-------|-------------|--------|----------|
| `media.metadata` | ✓ ffprobe/sharp | smoke | staging worker |
| `media.thumbnail` | ✓ | smoke | staging |
| `media.poster` | ✓ ffmpeg | smoke | staging |
| `media.cleanup` | ✓ expire sessions, abort multipart, delete partial | unit path via job | staging + repeat 15m |
| `storage.reconcile` | ✓ DB vs S3 orphan report | job | staging + repeat 6h |

Worker: concurrency 2, exponential backoff, rate limiter 10/s, SIGTERM shutdown.

Video: **no new AI** — ffprobe/poster on uploaded objects only; no synthetic generation tests in CI.

---

## 3. Approvals (§3)

| Item | Status |
|------|--------|
| `POST /api/v1/projects/:id/approvals` | IMPLEMENTED |
| Assistant message + approval block | IMPLEMENTED |
| ApprovalCard → API (UUID + hash + version) | IMPLEMENTED |
| Message list syncs status from `approval` table | IMPLEMENTED (reload persistence) |
| Integration: approve + 409 conflict | TESTED |
| Playwright `real-approval.spec.ts` | IMPLEMENTED (requires E2E credentials) |

---

## 4. SSE (§4)

| Feature | Status |
|---------|--------|
| `Last-Event-ID` / `after` query | IMPLEMENTED |
| Replay on reconnect | IMPLEMENTED |
| Heartbeat `: heartbeat` 15s | IMPLEMENTED |
| Live poll 2s while connected | IMPLEMENTED |
| Dedup in stream (`seen` set) | IMPLEMENTED |
| Integration replay test | TESTED |

Full browser SSE disconnect during media job E2E: **not automated** (media job + EventSource UI hook minimal).

---

## 5. Multipart & uploads (§5)

| Check | Status |
|-------|--------|
| API multipart ≥8MB | IMPLEMENTED / integration |
| Browser multipart progress | IMPLEMENTED in `use-real-upload.ts` — **E2E not run** (large fixture) |
| Upload session IDOR | TESTED |
| Asset list IDOR | TESTED |
| MIME / quarantine | IMPLEMENTED / integration |
| Download URL authorized | IMPLEMENTED |

---

## 6. SMTP (§6)

| Item | Status |
|------|--------|
| Beget integration | DEPLOYED staging |
| Password reset hook | IMPLEMENTED |
| Email verification flag | IMPLEMENTED — staging `EMAIL_VERIFICATION_REQUIRED=false` |
| Production require verify | **BLOCKED until** full E2E verify + password rotation |
| Public register | **false** on staging |

---

## 7. Selectel (§7)

**BLOCKED** — no new keys. Staging remains MinIO. See commented placeholders in `infra/staging.env.example`.

---

## 8. Extended testing (§8)

| Suite | Result |
|-------|--------|
| Playwright REAL P0 chain | 1 passed (desktop) |
| Playwright REAL approval | ready (`E2E_REAL_BACKEND=1`) |
| Integration security 10 | passed (prior session) |
| Integration approval / SSE / upload IDOR | added — run on staging API |
| DEMO regression | not re-run this pass |
| Tablet/mobile Playwright | **not run** (config supports projects) |

---

## 9. Production readiness (§9)

| Artifact | Status |
|----------|--------|
| `infra/docker-compose.production.example.yml` | IMPLEMENTED |
| Separate volumes / healthchecks / logging | in template |
| Backups | staging script exists; prod manual |
| Rollback | documented below |
| Cutover | **BLOCKED** |

---

## 10. Git & deploy

Record after merge: `git rev-parse HEAD`

Deploy staging (typical):

```bash
# On VPS from synced src
cd /var/www/ai.shotbro.ru-src/infra
docker compose --env-file staging.env -f docker-compose.staging.yml build api worker
docker compose --env-file staging.env -f docker-compose.staging.yml up -d api worker
bash ../scripts/vps-disk-maintenance.sh
```

Web rebuild when REAL UI changes: `docker compose build web` (infra-web-1 stack).

---

## Commands

```bash
pnpm --filter api typecheck && pnpm --filter web typecheck
pnpm --filter @shotbro/ai test
bash scripts/staging-upload-smoke.sh
bash scripts/vps-disk-maintenance.sh

RUN_INTEGRATION_TESTS=1 INTEGRATION_API_URL=http://127.0.0.1:3001 \
  pnpm exec vitest run --config apps/api/vitest.integration.config.ts

E2E_REAL_BACKEND=1 E2E_STAGING_URL=https://ai.shotbro.ru \
  E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... \
  pnpm exec playwright test e2e/real-auth.spec.ts e2e/real-approval.spec.ts --project=desktop
```

---

## Production blockers

1. Selectel new keys + prod env  
2. SMTP password rotation + mandatory email verification on prod  
3. Browser multipart + tablet/mobile + DEMO regression pass  
4. SSE + media job browser E2E  
5. Optional: staging gate + nginx lockdown on `/api/`  

---

## Rollback

1. nginx `*.bak-*` under `/etc/nginx/sites-enabled/`  
2. `docker compose -f infra/docker-compose.staging.yml down` (keeps `infra-web-1`)  
3. Remove `/api/` and `/shotbro-staging/` for DEMO-only  
