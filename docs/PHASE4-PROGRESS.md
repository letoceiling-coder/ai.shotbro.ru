# Phase 4 — Progress

**Branch:** `phase4/intelligent-production`  
**Checkpoint:** `12f3f4f` → Phase 4B commit (pending push)  
**Baseline:** `phase3-rc1` (`e66d480`)  
**Staging runtime:** `66c1d2f` (unchanged until 4C deploy)

Legend: **IMPLEMENTED** | **TESTED** | **INTEGRATED** | **DEPLOYED** | **BLOCKED BY POLICY** | **NOT IMPLEMENTED**

---

## 4A — Intelligent Agent

| Item | Status |
|------|--------|
| LLM Gateway | **IMPLEMENTED** **TESTED** |
| AgentRuntime | **IMPLEMENTED** **TESTED** **INTEGRATED** (flag `PHASE4_AGENT_RUNTIME_ENABLED`, default **false**) |
| ContextBuilder | **IMPLEMENTED** |
| Tool handlers (core) | **IMPLEMENTED** **INTEGRATED** (API delegates) |
| 12 mock evaluations | **TESTED** |

## 4B — Provider Engine (this milestone)

| Stage | Item | Status |
|-------|------|--------|
| B0 | Audit matrix | **IMPLEMENTED** (docs + code) |
| B1 | `provider_job` / events / attempts migration **0005** | **IMPLEMENTED** **TESTED** (DB test when `RUN_DB_INTEGRATION_TESTS=1`) |
| B1 | ProviderJobManager + PG store | **IMPLEMENTED** **TESTED** |
| B2 | Provider contracts (LLM/image/video/audio) | **IMPLEMENTED** |
| B3 | OpenRouter adapter | **IMPLEMENTED** **CONTRACT_TESTED** (mock transport) — live **BLOCKED BY POLICY** |
| B4 | Image provider framework + Phase4 mock | **IMPLEMENTED** **TESTED** |
| B5 | Video provider framework + Phase4 mock | **IMPLEMENTED** **TESTED** |
| B6 | ElevenLabs mock adapter | **IMPLEMENTED** **TESTED** |
| B7 | Job manager lifecycle + events | **IMPLEMENTED** **PARTIAL** (polling/webhook scheduler **NOT IMPLEMENTED**) |
| B8 | Asset ingestion SSRF guards | **IMPLEMENTED** **TESTED** (fixtures) |
| B9 | Model router `selectModel` | **IMPLEMENTED** **PARTIAL** |
| B10 | AgentRuntime → Orchestrator single path | **INTEGRATED** behind flag; default off preserves Phase 3 |
| B11 | Tool delegates (assets, approval, graph, mock jobs) | **IMPLEMENTED** **INTEGRATED** |
| B12 | Tests | unit **TESTED**; DB provider job **TESTED** (optional gate) |

## API

| Endpoint | Status |
|----------|--------|
| `GET /api/v1/projects/:id/provider-jobs` | **IMPLEMENTED** |
| `GET /api/v1/ai/models|providers|tools` | **IMPLEMENTED** (4A) |

## Policy

Real OpenRouter / image / video / ElevenLabs: **0**  
Production cutover: **NOT PERFORMED**

## Remaining (4C)

Frontend cards, webhook receiver, polling scheduler, staging deploy, full Phase 4 E2E, live adapters **BLOCKED BY POLICY**
