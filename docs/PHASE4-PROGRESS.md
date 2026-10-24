# Phase 4 — Progress

**Branch:** `phase4/intelligent-production`  
**Git HEAD:** `b1de217`  
**Staging:** **b1de217** (API/worker/web)

Legend: **IMPLEMENTED** | **TESTED** | **INTEGRATED** | **DEPLOYED** | **BLOCKED BY POLICY** | **NOT IMPLEMENTED**

## 4D — UI, SSE, rollout, browser E2E

| Item | Status |
|------|--------|
| Project-scoped AgentRuntime | **IMPLEMENTED** **TESTED** **DEPLOYED** |
| Admin + loopback rollout API | **IMPLEMENTED** **TESTED** |
| Run metadata `runtimeVersion` | **INTEGRATED** |
| SSE `message.created` + agent/production events | **INTEGRATED** **TESTED** |
| Web staging deploy (Docker → systemd) | **DEPLOYED** |
| Playwright Phase 3 × 4 viewports | **TESTED** **8/8 pass** |
| Playwright Phase 4 unified × 4 viewports | **TESTED** **8/8 pass** |
| Provider job UI on every SSE transition | **partial** |

## Prior milestones (4A–4C)

| Area | Status |
|------|--------|
| ProviderJob PG + scheduler | **DEPLOYED** **TESTED** |
| Mock ingestion → MinIO | **INTEGRATED** |
| AgentRuntime → Orchestrator (single runId) | **INTEGRATED** **TESTED** |
| Webhook HMAC | **DEPLOYED** |
| Live paid providers | **BLOCKED BY POLICY** |

Real OpenRouter / image / video / TTS: **0**  
Production cutover: **NOT PERFORMED**
