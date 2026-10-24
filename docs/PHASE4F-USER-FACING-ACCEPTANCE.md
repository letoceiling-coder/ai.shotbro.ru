# Phase 4F — User-facing acceptance & stability hardening

**Date:** 2026-10-24  
**Branch:** `phase4/intelligent-production`  
**Remote HEAD:** `3b31be8` (hardening series from `dbfb6ac`)

## Live runtime (VPS 85.117.235.93)

| Component | Value | Validation |
|-----------|--------|------------|
| Web listener | `127.0.0.1:3020` → `infra-web-1` | `staging-verify-web.sh` **PASS** |
| **Deployed web SHA** | **`9c22914`** (image label `org.shotbro.build-sha`) | digest matches running container |
| Image tag | `shotbro-web-build:9c22914` | `.deployed-web-image` |
| API/worker | **`4b127c7`** @ `:3021` | unchanged |
| systemd `ai-shotbro-web` | **disabled / inactive** | no EADDRINUSE |
| Disk `/` | ~44 GB free (~62% used) | pre-deploy check ≥8 GB |

Deployment writes **`DEPLOYED.txt` only after** local + HTTPS health and **image digest match**; rollback tag `infra-web:rollback`.

## Flaky root causes (Phase 3 viewports)

| Viewport | First failing step (before fix) | Root cause class |
|----------|----------------------------------|------------------|
| desktop1920 | — | **PASS first attempt** (with CI retries off, brief step fixed) |
| desktop1440 / tablet / mobile390 | `brief.scrollIntoViewIfNeeded` | **Playwright action timeout (45s)** called **before** `expect(...).toBeVisible(180s)` — element not in DOM yet |

Not login/session for the original flaky class; login hardening added separately (`/api/v1/users/me` poll).

## Fixes applied

- `agent-waits.ts`: visible-first waits; **`{ items: [] }`** agent runs list; **MP4 asset poll** via `/assets` before UI delivery.
- `approvals.ts`: wait for `POST .../approvals/:id/approve`; poll until approve buttons decrease (no fixed sleep).
- `real-login.ts`: session `/me` poll; agent run POST listen on send.
- `staging-deploy-web.sh`: disk preflight, rollback, digest check, **DEPLOYED after health**.
- `staging-verify-web.sh`: read-only validation.
- `regression-strict` mode: **`E2E_STRICT=1`, retries=0**.
- Spec timeout **20 min** for full mock FFmpeg chain (`3b31be8`).

## Playwright matrix (retries=0)

| Run | Log | Result |
|-----|-----|--------|
| `regression-strict` @ `9c22914` | `/tmp/regression-strict-9c22914.log` | **8 FAIL** — delivery UI 420s (test wall 10m) |
| `regression-strict` @ `b244537` | `/tmp/regression-strict-b244537.log` | **in progress / 10m wall** — same wall clock |
| `regression-strict` @ `3b31be8` | `/tmp/regression-strict-3b31be8.log` | **RUNNING** (20m test budget) |

Prior **`regression`** (retries=2): **8/8 green** with 3 Phase 3 **PASS AFTER RETRY** @ `cf51494`.

### Strict status legend

- **PASS FIRST ATTEMPT** — required for hardening sign-off  
- **PASS AFTER RETRY** — not counted for strict  
- **FAIL** — see trace under `apps/web/test-results/` on VPS  

## Security (staging.env, non-secret flags)

| Flag | Expected | Observed |
|------|----------|----------|
| `AI_MOCK_MODE` | true | true (compose) |
| `OPENROUTER_ENABLED` | false | false |
| `INTEGRATION_PROVISION_ENABLED` | false | **false** |
| `ALLOW_PUBLIC_REGISTER` | false | **false** |

Real OpenRouter / Fal / ElevenLabs: **0** · Production cutover: **NOT PERFORMED**

## Phase 4F stability sign-off

| Criterion | Status |
|-----------|--------|
| Deploy SHA = running container | **PASS** (`9c22914`) |
| REAL create + composer | **PASS** (diagnostic + regression) |
| Phase 3/4 strict 8/8 retries=0 | **PENDING** (`3b31be8` run) |
| MP4 + F5 | covered in regression specs |

**Blocker:** confirm **`regression-strict-3b31be8.log`** ends with **8 passed, 0 failed** before final close.
