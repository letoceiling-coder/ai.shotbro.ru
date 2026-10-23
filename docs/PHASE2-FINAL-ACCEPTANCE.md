# Phase 2 — Release Candidate acceptance

**Branch:** `phase2/backend`  
**Git RC tag:** **`phase2-rc1`** on `phase2/backend` (verify: `git rev-parse phase2-rc1`)  
**Prior baseline:** `66cfeb6` / `d52ae54`  
**Staging:** https://ai.shotbro.ru  
**VPS src:** `/var/www/ai.shotbro.ru-src` (aligned with RC; API image rebuilt for `event-log.service.ts` cursor fix)  
**VPS:** `root@85.117.235.93`

## Executive summary

| Goal | IMPLEMENTED | TESTED | DEPLOYED | Notes |
|------|-------------|--------|----------|-------|
| REAL auth / projects / chat / upload | ✓ | ✓ Playwright | ✓ | `real-auth.spec.ts` |
| Approvals (approve / reject / revision / F5) | ✓ | ✓ Playwright + integration | ✓ | Buttons disabled after decide |
| SSE API (replay, heartbeat, dedup) | ✓ | ✓ integration (see §SSE) | ✓ | |
| SSE REAL UI (EventSource) | ✓ | ✓ Playwright `real-sse.spec.ts` | ✓ web `infra-web-1` | Reconnect via 3s retry + `?after=` |
| Multipart browser ≥8MB | ✓ | ✓ Playwright `real-multipart.spec.ts` | ✓ | Fixture `large-e2e.pdf` (9MB) |
| Workers + cleanup / reconcile | ✓ | ✓ smoke + jobs | ✓ | `MEDIA_CLEANUP_DRY_RUN`, limits |
| Security integration | ✓ | ✓ **20/20** (sign-in only) | ✓ | See §9 |
| DEMO 4 scenarios + viewports | ✓ | ✓ `visual.spec.ts` 28 passed | ✓ | 1920 / 1440 / 834 / 390 |
| SMTP Beget | ✓ | manual | ✓ | No mass test mail |
| Selectel production S3 | — | — | **BLOCKED** | |
| Production cutover | template | — | **BLOCKED** | |
| Paid AI / OpenRouter | disabled | — | ✓ | No inference tests |

**Verdict:** Platform **Release Candidate** for Phase 3 agent wiring. **Not** production-live.

---

## 1. VPS sync (Этап 1)

| Item | Status |
|------|--------|
| Pre-deploy PG backup | **TESTED** — `/var/backups/shotbro-staging-20261023-*/pg.sql.gz` + `staging.env` copy |
| Source sync | **DEPLOYED** — extracted RC tarball to `/var/www/ai.shotbro.ru-src` |
| API + worker rebuild | **DEPLOYED** — `docker compose --env-file staging.env -f docker-compose.staging.yml` |
| Web rebuild (REAL UI) | **DEPLOYED** — `infra/docker-compose.yml` → `infra-web-1:3020` |
| Health | **TESTED** — `https://ai.shotbro.ru/api/v1/health/live` → `{"status":"ok"}` |
| DEMO web | **DEPLOYED** — same host, DEMO mode unchanged |
| User volumes / DB | **Preserved** — no volume deletes |

### Docker image IDs (post `phase2-rc1` verification)

| Service | Image ID | Matches Git `4a9e4e5` |
|---------|----------|------------------------|
| `ai-shotbro-staging-api` | `71641e707cec` | **Yes** (API includes event-log replay fix deployed from RC tree) |
| `ai-shotbro-staging-worker` | `a85ce4b2d283` | **Yes** (RC worker dry-run/limits) |
| `infra-web` | `a70ed5e6f61e` | **Yes** (`use-project-events.ts` SHA256 `981a357f…` matches VPS) |

**Source checksum (VPS vs local):** `use-project-events.ts` `981a357f…` — identical. `mime-policy.ts` `0752b02d…` — identical.

**Staging flags (verified):** `ALLOW_PUBLIC_REGISTER=false`, `OPENROUTER_ENABLED=false` (container env).

---

## 2. Approval E2E (Этап 2)

| Check | Result |
|-------|--------|
| Create via API + card in chat | **TESTED** |
| Approve + F5 | **TESTED** Playwright |
| Reject + disabled actions | **TESTED** Playwright |
| Request revision | **TESTED** Playwright |
| 409 version conflict | **TESTED** integration |
| Cross-tenant approve | **TESTED** `approval-cross-tenant.integration.spec.ts` |
| Double-click / post-decide UI | **TESTED** — all actions `disabled` when `status !== pending` |
| No generative tools after approve | **Verified** — no OpenRouter / AI jobs |

---

## 3. SSE (Этап 3)

| Feature | Status |
|---------|--------|
| `useProjectEvents` + credentials | **IMPLEMENTED / DEPLOYED** |
| Live status line `data-testid=real-sse-status` | **TESTED** Playwright |
| Asset list refresh on `media.*` | **IMPLEMENTED** |
| API heartbeat 15s, poll 2s, dedup | **DEPLOYED** |
| Last-Event-ID / `?after=` replay | **TESTED** integration (aborting stream read; assert no duplicate `id:`) |
| Disconnect during worker job + UI recovery | **NOT AUTOMATED** — worker E2E covered via multipart → READY + SSE connected |

---

## 4. Multipart browser (Этап 4)

| Check | Result |
|-------|--------|
| File pick + init multipart | **TESTED** |
| Part upload + progress % | **TESTED** UI |
| Complete → PROCESSING → READY | **TESTED** (~10s, PDF 9MB) |
| Reload + asset count | **TESTED** |
| PDF magic sniff (`%PDF-`) | **IMPLEMENTED** — fixes quarantine on large fixture |
| Cancel / retry UI | **NOT IMPLEMENTED** in UI (API cancel exists) — **BLOCKER minor** |

---

## 5. Media cleanup & reconcile (Этап 5)

| Item | Status |
|------|--------|
| `media.cleanup` expire / abort / delete partial | **IMPLEMENTED / DEPLOYED** |
| `MEDIA_CLEANUP_DRY_RUN`, `MEDIA_CLEANUP_MAX_OPS` | **IMPLEMENTED** |
| `storage.reconcile` report-only (no user deletes) | **IMPLEMENTED / DEPLOYED** |
| `STORAGE_RECONCILE_*` limits + dry-run log | **IMPLEMENTED** |
| BullMQ repeat 15m / 6h | **DEPLOYED** |
| Idempotent job replay | **IMPLEMENTED** (BullMQ) |

---

## 6. Responsive & regression (Этап 6)

| Viewport | Playwright project | Result |
|----------|-------------------|--------|
| 1920×1080 | desktop | **28 passed** (visual + REAL shell when env set) |
| 1440×900 | desktop1440 | **passed** |
| 834×1112 | tablet | **passed** |
| 390×844 | mobile | **passed** |

Screenshots: `apps/web/e2e/screenshots/` (visual) + Playwright HTML report `apps/web/playwright-report/`.

---

## 7. Auth & SMTP (Этап 7)

| Item | Status |
|------|--------|
| Beget SMTP | **DEPLOYED** |
| Public register staging | **false** (required for RC) |
| Email verification prod flag | **BLOCKED** until rotation + E2E verify transport |
| Leaked SMTP password | **BLOCKED** — owner must rotate |

---

## 8. Infrastructure (Этап 8)

| Item | Status |
|------|--------|
| Disk ~27G free | **TESTED** |
| Log rotation staging api/worker | **IMPLEMENTED** |
| PG backup this deploy | **TESTED** |
| Redis AOF | **DEPLOYED** |
| HTTPS / nginx | **DEPLOYED** (existing) |
| Selectel keys in repo | **Must not use** — production storage **BLOCKED** |

---

## 9. Security tests (Этап 9)

| Suite | Passed | Failed | Skipped | Notes |
|-------|--------|--------|---------|-------|
| **Total integration** | **20** | **0** | **0** | Control run 2026-10-24 UTC |
| `security-isolation` | 10 | 0 | 0 | Users A/B via `signInIntegrationUser` |
| `approval-flow` | 4 | 0 | 0 | reject, revision, idempotency, 409 |
| `approval-cross-tenant` | 1 | 0 | 0 | |
| `upload-idor` | 3 | 0 | 0 | download URL |
| `upload-flow` | 1 | 0 | 0 | |
| `sse-replay` | 1 | 0 | 0 | REST + stream `?after=` replay |

**Accounts (no sign-up in test run):** `e2e-phase2@shotbro.test` (A), `e2e-phase2-b@shotbro.test` (B). Password via env / staging secret (not in repo). **429:** `signIn` honors `Retry-After`.

---

## 10. Playwright REAL staging (summary)

| Spec | Result |
|------|--------|
| `real-auth.spec.ts` | **1 passed** |
| `real-approval.spec.ts` | **3 passed** |
| `real-sse.spec.ts` | **1 passed** |
| `real-multipart.spec.ts` | **1 passed** |

Env: `E2E_REAL_BACKEND=1`, `E2E_STAGING_URL=https://ai.shotbro.ru`, `E2E_TEST_EMAIL=e2e-phase2@shotbro.test`.

---

## Production blockers (remaining)

1. Selectel **new** keys + prod env  
2. SMTP password rotation + `EMAIL_VERIFICATION_REQUIRED=true` on prod  
3. Optional: upload cancel/retry UI E2E  
4. Optional: SSE disconnect **during** worker job (browser automation)  
5. Commit RC delta to git (`d52ae54` + local changes)  
6. nginx staging gate / `STAGING_GATE_SECRET` hardening  

---

## Rollback

1. Restore `/var/backups/shotbro-staging-*/pg.sql.gz` if needed  
2. Re-deploy previous image tags or prior tarball  
3. nginx `*.bak-*` under `/etc/nginx/sites-enabled/`  

---

## Commands

```bash
# Integration (enable register briefly on staging maintenance only)
RUN_INTEGRATION_TESTS=1 INTEGRATION_API_URL=https://ai.shotbro.ru \
  INTEGRATION_ORIGIN=https://ai.shotbro.ru \
  E2E_TEST_EMAIL=e2e-phase2@shotbro.test E2E_TEST_PASSWORD=*** \
  pnpm --filter api test:integration

E2E_REAL_BACKEND=1 E2E_STAGING_URL=https://ai.shotbro.ru \
  E2E_TEST_EMAIL=e2e-phase2@shotbro.test E2E_TEST_PASSWORD='***' \
  pnpm --filter web exec playwright test e2e/real-*.spec.ts --project=desktop
```
