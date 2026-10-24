# Phase 4 — Final acceptance

**Status:** Phase **4E** staging provider-readiness release accepted (mock-only). Playwright **8/8** · VPS smokes **PASS**. Not **LIVE_PRODUCTION_READY**.

**Branch:** `phase4/intelligent-production`  
**Git HEAD:** `4a3896f` (see follow-up commits for E2E/docs if any)  
**Baseline:** `phase3-rc1` → `e66d480` · 4D `b1de217` · 4E `4a3896f`

## Policy

| Metric | Value |
|--------|-------|
| Real OpenRouter / image / video / TTS | **0** |
| Production cutover | **NOT PERFORMED** |
| `AI_MOCK_MODE` | **true** |
| Global `PHASE4_AGENT_RUNTIME_ENABLED` (staging) | **false** |
| Project-scoped AgentRuntime | **`PHASE4_PROJECT_SCOPED_ENABLED=true`** |

## Staging deployment (2026-10-24, 4E)

| Component | SHA / ID |
|-----------|----------|
| API | `ai-shotbro-staging-api:latest` → `4956f5b816c4…` |
| Worker | `ai-shotbro-staging-worker:latest` → `b43c2b55bae0…` |
| Web (systemd @ :3020) | `shotbro-web-build:4a3896f` → `43ba63bd36ab` |
| `DEPLOYED.txt` | **4a3896f** |
| Migration 0005 | Applied (not re-run) |
| PG backup | `/var/backups/shotbro-staging-4e.sql.gz` + restore test **OK** |

Details: **`PHASE4E-PROVIDER-READINESS.md`**

Web path: `infra/scripts/staging-deploy-web.sh` (Docker build → `/var/www/ai.shotbro.ru/standalone`).

## AgentRuntime rollout (4D)

| Mode | Behavior |
|------|----------|
| Default | Phase **3** orchestrator only |
| Per-project | `project.settings.agentRuntimeV4` via **admin allowlist** (`PHASE4_ROLLOUT_ADMIN_EMAILS`) or **loopback** internal API |
| Run pinning | `metadata.runtimeVersion` set at **createRun**, not changed mid-run |
| Audit | `agent.runtime.rollout.changed` in EventLog |

API:
- `GET/POST /api/v1/projects/:id/agent/runtime-rollout` (admin email allowlist)
- `POST /api/v1/internal/projects/:id/agent-runtime-rollout` (loopback + `INTEGRATION_ROLLOUT_*`)

## E2E results

| Test | Viewports | Result |
|------|-----------|--------|
| `phase3-mock-production.spec.ts` | 1920, 1440, tablet, 390 | **4/4 pass** |
| `phase4-unified-production.spec.ts` | 1920, 1440, tablet, 390 | **4/4 pass** |
| API smokes (VPS) | n/a | Phase 3 + Phase 4 unified **pass** |

Staging URL: `https://ai.shotbro.ru`, `E2E_REAL_BACKEND=1`.

## SSE / UI (4D)

| Item | Status |
|------|--------|
| `message.created` on assistant blocks | **INTEGRATED** |
| SSE invalidates messages / assets / agent-runs | **INTEGRATED** (`use-project-events`) |
| Event aliases (`agent.approval.required`, `production.delivery.ready`) | **INTEGRATED** |
| Chat blocks from orchestrator (plan, script, board, cost, …) | **INTEGRATED** (existing) |
| `production_progress` on mock production start | **INTEGRATED** |
| Full provider_status stream from worker | **partial** (cards + API list; not every transition) |

## Sign-off

Both production paths with **mock MP4 in MinIO**, **reload persistence**, **no paid AI**, project-scoped Phase 4 agent:

1. Phase 3 fallback — **confirmed** (Playwright + API smoke)  
2. Phase 4 unified agent — **confirmed** (Playwright + API smoke)

Remaining (non-blocking): richer provider job SSE per transition; dedicated PostgreSQL integration job on isolated DB in CI.
