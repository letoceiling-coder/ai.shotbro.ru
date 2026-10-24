# Phase 4F — User-facing acceptance (closeout)

**Date:** 2026-10-24  
**Branch:** `phase4/intelligent-production`  
**Git HEAD (local/remote):** `6513b63` (+ pending commit `DialogTrigger` fix if push completes)

## Runtime (VPS 85.117.235.93)

| Component | SHA | Status |
|-----------|-----|--------|
| Web (systemd `:3020`) | **`046016b`** (`shotbro-web-build:046016b`) | **DEPLOYED** |
| API / worker (Docker) | **`4b127c7`** | **DEPLOYED** (unchanged in closeout) |
| Source tree `DEPLOYED.txt` | `046016b` | synced via tarball |

## Playwright runner

| Check | Status |
|-------|--------|
| Script | `infra/scripts/staging-playwright-e2e.sh` |
| Docker image | `mcr.microsoft.com/playwright:v1.64.1-jammy` (matches lockfile `@playwright/test@1.64.1`) |
| Secrets in stdout | **OK** — `env_val` grep only; no password echo |
| Exit code on failure | **OK** — `regression` mode uses `set -e` |
| Modes | `full` · `audit` · `regression` |
| Test accounts | `INTEGRATION_USER_A_*` / `E2E_TEST_*` from `staging.env` only |

## E2E results (VPS, live https://ai.shotbro.ru)

| Suite | Expected | Actual | Notes |
|-------|----------|--------|-------|
| `phase4f-studio-audit` (4 viewports) | 4/4 | **4/4 PASS** | `audit` mode, ~7.6s |
| Phase 3 mock production × 4 viewports | 4/4 | **0/4 FAIL** | See blockers |
| Phase 4 unified × 4 viewports | 4/4 | **0/4 FAIL** | Same setup path |
| **Regression total** | **8/8** | **0/8** | Log: `/tmp/phase4f-regression-final5.log` on VPS |

### Root cause (regression)

1. **NewProjectDialog** did not open from Playwright click on external «Новый проект» button (controlled `open` without `DialogTrigger`). E2E fell back to API create but **RealComposer** did not mount reliably when selecting the new project in the sidebar (~60s timeout).
2. Fix prepared: **`DialogTrigger` co-located with dialog** in `new-project-dialog.tsx` / `real-projects-sidebar.tsx` (commit pending deploy after push).
3. E2E helpers updated on VPS (`real-login.ts` @ `6513b63`): REAL mode guard (no DEMO banner), sidebar-scoped create, UI-first + API fallback, placeholder-based composer checks.

### API smokes (VPS)

| Smoke | Result |
|-------|--------|
| Phase 3 fallback | **PASS** (`mock:true`) |
| Phase 4 unified | **PASS** (`mock:true`) |

## Policy / security (staging)

| Flag | Required | Observed |
|------|----------|----------|
| `AI_MOCK_MODE` | `true` | **true** in `docker-compose.staging.yml` (api/worker) |
| `OPENROUTER_ENABLED` | `false` | **false** in compose |
| `OPENROUTER_ALLOW_PAID_REQUESTS` | `false` | **false** in compose |
| `PROVIDER_LIVE_EXECUTION_ENABLED` | `false` | **false** in compose |
| `PHASE4_AGENT_RUNTIME_ENABLED` | `false` global | **false** default in compose; Phase 4 E2E uses **project-scoped** rollout API |
| `ALLOW_PUBLIC_REGISTER` | `false` | present in `staging.env` |
| `INTEGRATION_PROVISION_ENABLED` | `false` (closeout target) | **may be true** on staging for E2E users — verify before production; no paid AI regardless |

## UI component matrix (REAL, web `046016b`)

| Component | IMPLEMENTED | WIRED | VISIBLE | TESTED (browser) |
|-----------|-------------|-------|---------|------------------|
| NewProjectDialog | yes | yes | yes | **partial** (audit REAL; dialog open blocked in regression) |
| REAL sidebar | yes | yes | yes | audit |
| Context / Production / Assets / Models | yes | yes | yes | audit |
| AgentRunStrip | yes | yes | when project selected | regression blocked |
| RealComposer + ModelSelector | yes | yes | yes | regression blocked |
| Approval / production blocks | yes | yes | yes | regression blocked |
| Mock MP4 delivery | yes | yes | — | regression blocked |

## Screenshots (VPS)

`apps/web/test-results/phase4f-{demo|real}-{desktop1920|desktop1440|tablet|mobile390}.png`

Additional traces/screenshots under `apps/web/test-results/` from failed regression runs (no secrets).

## Phase 4F sign-off

| Criterion | Status |
|-----------|--------|
| 8/8 E2E PASS | **BLOCKED** |
| REAL project via UI dialog | **FIX READY** (DialogTrigger); **not deployed** at closeout |
| Mock production in browser | **BLOCKED** (E2E) — **PASS** via API smokes |
| F5 persistence | in spec; not reached while create step fails |
| Zero paid AI | **CONFIRMED** (policy + smokes) |

## Next steps (server-only)

1. Push/deploy web commit with `DialogTrigger` fix (new SHA after `6513b63`).
2. Sync `apps/web/e2e/helpers/real-login.ts` to VPS (already on `6513b63`).
3. `bash infra/scripts/staging-playwright-e2e.sh /var/www/ai.shotbro.ru-src regression` → expect **8/8 PASS** (~30–90 min).
4. `bash … staging-playwright-e2e.sh … full` (audit + regression) and archive `test-results/` for report.

**Policy unchanged:** no production cutover, no live paid providers.
