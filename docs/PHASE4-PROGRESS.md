# Phase 4 — Progress

**Branch:** `phase4/intelligent-production`  
**Git HEAD:** `3a7c978`  
**Staging:** API/worker **4b127c7** · web **`9c22914`**

Legend: **IMPLEMENTED** | **TESTED** | **INTEGRATED** | **DEPLOYED** | **BLOCKED BY POLICY** | **NOT IMPLEMENTED**

## 4D — UI, SSE, rollout, browser E2E

| Item | Status |
|------|--------|
| Project-scoped AgentRuntime | **IMPLEMENTED** **TESTED** **DEPLOYED** |
| Admin + loopback rollout API | **IMPLEMENTED** **TESTED** |
| Run metadata `runtimeVersion` | **INTEGRATED** |
| SSE `message.created` + agent/production events | **INTEGRATED** **TESTED** |
| Web staging deploy (Docker compose `:3020`) | **DEPLOYED** |
| Playwright Phase 3 × 4 viewports | **TESTED** **8/8 pass** |
| Playwright Phase 4 unified × 4 viewports | **TESTED** **8/8 pass** |
| Provider job UI on every SSE transition | **partial** → see **4E** |

## 4E — Provider readiness (no live inference)

| Item | Status |
|------|--------|
| Typed Fal / ElevenLabs / OpenRouter adapters | **IMPLEMENTED** |
| HTTP contract tests (mock transport) | **TESTED** 45/45 `@shotbro/ai` |
| ProviderJob SSE (`provider.job.status`) | **IMPLEMENTED** |
| Model catalog API | **IMPLEMENTED** |
| PostgreSQL CI workflow | **IMPLEMENTED** (GitHub Actions) |
| Staging deploy + Playwright regression | **STAGING_TESTED** **8/8** |
| GitHub Actions PG CI | **BLOCKED** (verify in GitHub UI) |
| Tool path vendor swap | **NOT IMPLEMENTED** (mock tools remain) |

Details: **`PHASE4E-PROVIDER-READINESS.md`**.

## 4F — User-facing product integration

| Item | Status |
|------|--------|
| UI audit (DEMO vs REAL) | **DOCUMENTED** |
| REAL context panel + agent strip | **IMPLEMENTED** **DEPLOYED** **VISIBLE** |
| Project templates dialog | **IMPLEMENTED** **WIRED** **VISIBLE** |
| Model selector wired to catalog | **WIRED** **VISIBLE** |
| Web staging deploy | **DEPLOYED** **`4a89fef`** |
| VPS Playwright audit (4 viewports) | **TESTED** **4/4 PASS** |
| Phase 3/4 Playwright regression (retries=2) | **8/8** @ `cf51494` (3 Phase 3 pass after retry) |
| Playwright **regression-strict** (retries=0) | **8/8 PASS** @ `3a7c978` |
| Deploy digest validation + verify script | **DEPLOYED** `dbfb6ac`…`9c22914` |
| RealComposer + thread loading fix | **FIXED** `7604e76`…`4a89fef` |
| `staging-playwright-e2e.sh` (Docker) | **IMPLEMENTED** |

See **`PHASE4F-UI-AUDIT.md`**, **`PHASE4F-USER-FACING-ACCEPTANCE.md`**.

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
