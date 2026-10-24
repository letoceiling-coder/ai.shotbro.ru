# Phase 4 — Final acceptance

**Status:** Phase 4C in progress — staging deploy required for final sign-off.

**Branch:** `phase4/intelligent-production`  
**Baseline:** `phase3-rc1` → `e66d480`

## Policy (confirmed each release)

| Metric | Value |
|--------|-------|
| Real OpenRouter inference | **0** |
| Real image / video / TTS | **0** |
| Production cutover | **NOT PERFORMED** |
| `AI_MOCK_MODE` | **true** |
| `PHASE4_AGENT_RUNTIME_ENABLED` (staging default) | **false** until smoke pass |

## Phase 4C deliverables (code)

| Area | Status |
|------|--------|
| Migration **0005** | **IMPLEMENTED** |
| Provider job scheduler (mock poll) | **IMPLEMENTED** |
| Webhook receiver (HMAC, replay window) | **IMPLEMENTED** |
| Asset ingestion → MinIO | **IMPLEMENTED** |
| Production UI blocks (provider_status, production_progress, delivery) | **IMPLEMENTED** |
| Agent trace API `GET .../runs/:runId/trace` | **IMPLEMENTED** |
| traceId in run metadata | **IMPLEMENTED** |
| E2E Scenario 1 | `phase3-mock-production.spec.ts` @ flag **false** |
| E2E Scenario 2 | `PHASE4_AGENT_RUNTIME_ENABLED=true` on test projects only — **pending staging smoke** |

## Staging (fill after deploy)

| Item | Value |
|------|--------|
| Deployed SHA | _pending_ |
| Docker API / Worker / Web IDs | _pending_ |
| Migration 0005 on staging DB | _pending_ |
| Phase 3 fallback E2E 4/4 | _pending_ |
| Phase 4 unified E2E | _pending_ |

See [PHASE4-PROGRESS.md](./PHASE4-PROGRESS.md).
