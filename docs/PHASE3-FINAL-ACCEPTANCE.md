# Phase 3 — Release Candidate acceptance (RC1)

**Branch:** `phase3/agent`  
**Project:** https://ai.shotbro.ru  
**VPS:** `root@85.117.235.93`  
**GitHub:** `git@github.com:letoceiling-coder/ai.shotbro.ru.git`  

## Git / deploy consistency (2026-10-24 RC1 closeout)

| Item | Value |
|------|--------|
| **Git HEAD (local/remote after RC1 commit)** | see `git rev-parse origin/phase3/agent` |
| **Staging runtime (`DEPLOYED.txt`)** | `66c1d2f` (API/worker; docs/e2e-only commits do not change runtime until next web/API deploy) |
| **Tag `phase3-rc1`** | created after acceptance commit (annotated) |
| **Force push** | not used |
| **phase2-rc1** | unchanged |

| Image | ID (short) |
|-------|------------|
| API | `21516745c50c` |
| Worker | `376ea777aeeb` |
| Web | `d943d2778efe` |

**Mock / billing flags:** `OPENROUTER_ENABLED=false`, `ALLOW_PUBLIC_REGISTER=false`; app defaults keep `AI_MOCK_MODE=true`, `OPENROUTER_ALLOW_PAID_REQUESTS=false`, `PROVIDER_LIVE_EXECUTION_ENABLED=false` (`packages/config`).

**Real AI inference / paid media / production cutover:** 0 / 0 / NOT PERFORMED.

---

## Playwright — `phase3-mock-production.spec.ts`

**Env:** `E2E_REAL_BACKEND=1`, `E2E_STAGING_URL=https://ai.shotbro.ru`, User A credentials (staging integration users).

| Project | Result | Duration (approx.) |
|---------|--------|---------------------|
| desktop | **pass** | ~30s |
| desktop1440 | **pass** | ~25s |
| tablet | **pass** | ~25s |
| mobile | **pass** | ~25s |

**Mobile root cause (fixed):** the spec clicked **«Новый REAL-проект»** in the project list (existing project title) instead of **«Новый проект»** (create). Empty-state heading **«REAL-проект»** only appears for a new thread (`real-thread.tsx`). **Fix:** `openRealNewProject()` in `apps/web/e2e/helpers/real-login.ts`; removed wrong click in `phase3-mock-production.spec.ts`; `aria-label` on create button in `real-projects-sidebar.tsx`.

**Skipped tests:** none in this spec (skipped elsewhere do not count as pass).

---

## API integration @ staging

`RUN_INTEGRATION_TESTS=1`, in-container `INTEGRATION_API_URL=http://127.0.0.1:3001` (2026-10-24 post–secret rotation):

| Result | Count |
|--------|-------|
| Pass | **22** |
| Skip | **9** (agent E2E, DB-gated hardening, etc.) |
| Fail | **0** |

Includes security isolation, cross-tenant approval, upload IDOR, SSE replay, approval flow, phase3-rc guards.

---

## PostgreSQL budget integration (isolated DB)

| Item | Value |
|------|--------|
| Container | `shotbro-budget-test-pg` on `ai-shotbro-staging_staging_internal` |
| Migrations | `0000`–`0004` applied to `shotbro_test` |
| Command | `RUN_DB_INTEGRATION_TESTS=1` + `DATABASE_URL=postgresql://shotbro:***@shotbro-budget-test-pg:5432/shotbro_test` |
| `cost-reservation.db.integration.spec.ts` | **3/3 pass** (concurrency idempotency, budget cap, RELEASE ledger) |
| Script | `infra/scripts/staging-run-budget-db-tests.sh` |

No destructive budget tests on staging user projects.

---

## Provisioning secret & hardening

| Check | Result |
|-------|--------|
| Secret rotation | **DONE** on VPS (`staging-rotate-provision-secret.sh`); new value **not** in repo/logs/chat |
| Old / wrong secret | **403** from external curl; loopback with garbage secret **non-200** |
| Post-RC1 provisioning | **DISABLED** (`INTEGRATION_PROVISION_ENABLED=false`, `staging-disable-provision.sh`) |
| Sign-in User A/B | **200** (smoke after rotation) |
| Public register | **false** |

Prior log exposure of provision header — mitigated by rotation + pino redaction (`66c1d2f`).

---

## RC1 verdict

**ACCEPTED** for Phase 3 Release Candidate on staging mock-production path: all mandatory viewports, budget DB tests, secret rotation, integration security regression, deploy at **`66c1d2f`** runtime with RC1 git/docs/e2e checkpoint on `phase3/agent`.

**GitHub default branch:** not changed (requires admin / `gh auth`); recommend setting default to **`phase3/agent`** for active Phase 3 work.

**Full hardening narrative:** [PHASE3-RC-HARDENING.md](./PHASE3-RC-HARDENING.md)  
**Progress index:** [PHASE3-PROGRESS.md](./PHASE3-PROGRESS.md)
