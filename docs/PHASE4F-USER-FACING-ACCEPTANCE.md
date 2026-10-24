# Phase 4F — User-facing acceptance (closeout)

**Date:** 2026-10-24  
**Branch:** `phase4/intelligent-production`  
**Git HEAD (remote):** `cf51494` (web UI: `4a89fef` + deploy/E2E: `7604e76`…`cf51494`)

## Runtime (VPS 85.117.235.93)

| Component | SHA / listener | Status |
|-----------|----------------|--------|
| **Web (live `:3020`)** | **`4a89fef`** via **`infra-web-1`** (docker compose) | **DEPLOYED** |
| Web standalone backup | `shotbro-web-build:4a89fef` in `/var/www/ai.shotbro.ru/standalone` | snapshot OK |
| systemd `ai-shotbro-web.service` | n/a | **STOPPED** (EADDRINUSE — compose owns `:3020`) |
| API / worker (staging compose) | **`4b127c7`** @ `127.0.0.1:3021` | **UNCHANGED** |
| Nginx | `/` → `:3020`, `/api/` → `:3021` | OK |
| Disk `/` | ~54 GB free (~54% used post-prune) | OK for builds |

### Deployment root cause (fixed)

`staging-deploy-web.sh` built image and restarted **systemd**, but **docker compose `infra-web-1` already bound `127.0.0.1:3020`**. Systemd failed with `EADDRINUSE`; live site kept an **18h-old** `infra-web` image while `DEPLOYED.txt` recorded newer SHAs. Deploy script now **`docker compose up -d --force-recreate web`** and stops systemd.

## RealComposer root cause (fixed)

1. **`RealThread`** returned full-page «Загрузка…» while messages were fetching → **RealComposer unmounted** for up to 60s+ (Playwright timeout on placeholder).
2. **Stale web image** (above) served pre-fix UI.
3. E2E **API fallback** after dialog failure masked UI defects; removed — UI-only create path.

**Fixes:** `real-thread.tsx` (composer always mounted; loading only in message pane), `use-real-studio.ts` + ensure default conversation, `real-composer.tsx` testids, `staging-deploy-web.sh`, `real-login.ts` (no API create fallback; mobile-safe assertions).

## Playwright runner

| Check | Status |
|-------|--------|
| Script | `infra/scripts/staging-playwright-e2e.sh` |
| Modes | `full` · `audit` · `regression` · **`diagnostic`** |
| Docker image | `mcr.microsoft.com/playwright:v1.64.1-jammy` |
| Secrets in stdout | **OK** |

## E2E results (VPS, live https://ai.shotbro.ru)

| Suite | Result | Log / artifacts |
|-------|--------|-----------------|
| **Diagnostic** (`diagnostic`) | **1/1 PASS** (~4s) | `/tmp/phase4f-diagnostic-4a89fef.log` |
| Phase 3 mock × 4 viewports | **PASS** (3 marked *flaky*, passed on retry) | `/tmp/phase4f-regression-cf51494.log` |
| Phase 4 unified × 4 viewports | **4/4 PASS** | same |
| **Regression total** | **8/8 green** (5 strict + 3 flaky→pass) | `apps/web/test-results/` on VPS |

### Remaining noise

- Phase 3 on **desktop1440 / tablet / mobile** occasionally flakes on login or first agent signal; retries succeed. Not a composer blocker.

## Policy / security (staging)

| Flag | Required | Observed |
|------|----------|----------|
| `AI_MOCK_MODE` | `true` | **true** (api/worker compose) |
| `OPENROUTER_ENABLED` | `false` | **false** |
| `OPENROUTER_ALLOW_PAID_REQUESTS` | `false` | **false** |
| `PROVIDER_LIVE_EXECUTION_ENABLED` | `false` | **false** |
| Real OpenRouter / Fal / ElevenLabs calls | **0** | enforced by compose |
| Production cutover | **NOT PERFORMED** | — |

## Phase 4F sign-off

| Criterion | Status |
|-----------|--------|
| REAL project create via UI | **PASS** (diagnostic + regression) |
| Project selected → thread + composer | **PASS** |
| Send message → mock agent chain | **PASS** (regression; some flaky retries) |
| MP4 + reload | **PASS** on viewports that completed full chain |
| 8/8 regression matrix | **PASS with retries** (`cf51494` run) |

**Phase 4F:** **CLOSE WITH NOTE** — composer/deploy blockers resolved; treat flaky Phase 3 retries as follow-up hardening, not a REAL UI regression.
