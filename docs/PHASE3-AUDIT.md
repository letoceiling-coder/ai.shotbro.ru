# Phase 3 — Audit (baseline Phase 2 RC)

**Audit date:** 2026-10-24  
**Branch at audit:** `phase2/backend`  
**HEAD commit:** `e5c4045967e8a3b0b6f6d69ef0a452bb1b144d54` (`phase2: finalize release candidate`)  
**Tag `phase2-rc1`:** peels to `e5c4045967e8a3b0b6f6d69ef0a452bb1b144d54` (same as RC HEAD). An earlier local peel to `06c42be` was stale before tag was moved at commit time.

**Staging:** https://ai.shotbro.ru  
**VPS src:** `/var/www/ai.shotbro.ru-src`

---

## 1. Monorepo layout

| Area | Path | Phase 3 readiness |
|------|------|-------------------|
| Web (Next.js) | `apps/web` | REAL chat, SSE, approval cards, demo blocks — **reuse, extend for REAL agent blocks** |
| API (NestJS) | `apps/api` | Projects, messages, approvals, assets, uploads, SSE, BullMQ scaffold, **minimal AI registry** |
| Worker | `apps/worker` | Media jobs, cleanup/reconcile — **extend for production DAG** |
| DB | `packages/db` | Single migration `0000_*`; **agent_run / tool_execution / generation_job exist** |
| Contracts | `packages/contracts` | Zod blocks (mostly `demo: true`), API DTOs — **needs production entities + REAL blocks** |
| Config | `packages/config` | S3, SMTP, OpenRouter guards — **missing AI_MOCK_MODE / PROVIDER_LIVE_EXECUTION_ENABLED** |
| AI | `packages/ai` | Orchestrator scaffold, mock/OpenRouter adapters, model/tool registries, cost estimator — **Phase 3 core extension point** |
| agent-core | `packages/agent-core` | **Stub** — demo tool IDs only; web transpiles; **consolidate into @shotbro/ai or bridge** |
| provider-sdk | `packages/provider-sdk` | **Stub** — empty registry; **merge interfaces into @shotbro/ai** |

---

## 2. PostgreSQL (Drizzle)

**Existing tables relevant to Phase 3:**

- `project`, `conversation`, `message`, `message_block`, `message_attachment`
- `approval` — version + payload hash; wired to REAL UI
- `asset`, `asset_version`, upload sessions
- `generation_job` — typed jobs with idempotency
- `agent_run`, `tool_execution` — **schema only; no API/workflow usage yet**
- `event_log`, `audit_event` — SSE + audit

**Missing for Phase 3 TZ:**

- Versioned production documents (brief, plan, script, storyboard, …)
- Production state machine column(s) on agent runs
- Production graph (DAG nodes in PG)
- Project memory (brand, characters, preferences)
- Cost reservation / budget ledger tables
- Prompt versions table

---

## 3. API surface (actual)

| Endpoint | Status |
|----------|--------|
| `GET /api/v1/ai/registry` | **IMPLEMENTED** — models, tools, OpenRouter flags |
| Agent runs, brief, script, storyboard, production-graph, cost estimate | **NOT IMPLEMENTED** |
| Approvals, messages, events, assets | **IMPLEMENTED** (Phase 2) |

---

## 4. `@shotbro/ai` (actual code)

- **AgentOrchestrator:** `plan()`, `runMockTurn()` only; no multi-step agent, no tool execution loop
- **ToolRegistry:** 3 tools (`project.read`, `media.analyze`, `generate.image` disabled)
- **ModelRegistry:** `mock/text` enabled; `openrouter/auto` disabled
- **MockProviderAdapter:** deterministic echo; no image/video/audio job lifecycle
- **OpenRouterProviderAdapter:** throws before network when disabled
- **Tests:** `phase2-guards.test.ts` — mock turn, OpenRouter block, disabled tools

---

## 5. Frontend blocks (demo-first)

Components under `apps/web/src/components/chat/blocks/` map 1:1 to `MessageBlockSchema` types. Most blocks require `demo: true` in Zod; REAL API returns blocks without strict server-side Zod on read. Phase 3 must add **mock-labelled REAL blocks** without breaking DEMO scenarios.

**Existing cards usable for agent output:** `generation-plan`, `script`, `storyboard`, `cost_estimate`, `model_comparison`, `approval`, `tool_execution`, `agent_activity`, media result cards.

**Missing TZ cards:** BriefCard, ProductionPlanCard (structured), ProductionProgressCard, TimelineCard, DeliveryCard, CharacterCard — **partial overlap with existing names**.

---

## 6. Queues & workers

- `MediaQueueService` in API — enqueue media processing
- Worker processes uploads/transcode paths
- **No** FlowProducer / production DAG worker yet
- Redis is execution infra; job rows in PG for `generation_job`

---

## 7. Security & cost (Phase 2)

- `OPENROUTER_ENABLED=false` enforced on staging
- `OPENROUTER_ALLOW_PAID_REQUESTS` rejected by Zod if true while OpenRouter enabled
- `assertOpenRouterRequestsAllowed()` before any OpenRouter call
- Cross-tenant approval tests — 20/20 integration
- **Gap:** no global `PROVIDER_LIVE_EXECUTION_ENABLED` gate for future image/video/TTS adapters

---

## 8. Approvals

- `ApprovalService` creates message blocks + SSE events
- Status: PENDING / APPROVED / REJECTED / REQUIRES_REVISION / EXPIRED
- `targetType`, `targetVersion`, `payloadHash` — suitable for PLAN / SCRIPT / STORYBOARD / COST types
- **Gap:** typed approval enums and invalidation on document version change (logic not implemented)

---

## 9. Event / SSE

- Event log with replay (`after` cursor fix in RC)
- Web `useProjectEvents` — REAL mode
- **Gap:** agent.run.*, production.step.*, cost.* events not emitted

---

## 10. Phase 3 gaps summary (priority)

1. **Domain persistence** — production documents, state machine, graph, memory, prompts  
2. **Agent orchestration** — intent → brief → plan → script → storyboard → graph → mock media → assembly  
3. **Tool registry** — TZ tool list with Zod, side-effect classes, EXTERNAL_PAID hard block  
4. **Provider layer** — mock image/video/audio with job lifecycle; ElevenLabs scaffold only  
5. **Cost engine** — estimate, reserve, invalidate on version change (mock events in Phase 3)  
6. **API v1** — agent runs + production CRUD  
7. **Frontend** — wire REAL thread to agent runs; production board (lightweight)  
8. **Tests** — unit state machine; integration agent persistence; Playwright mock E2E; mandatory paid-block test  

---

## 11. Non-goals for Phase 3 start

- No OpenRouter live inference  
- No paid image/video/TTS  
- No production cutover  
- No UI palette / DEMO scenario removal  

---

## 12. Recommended consolidation

- Implement Phase 3 orchestration in **`@shotbro/ai`**, not a third orchestrator in `agent-core`  
- Keep `agent-core` as thin re-export or deprecate gradually to avoid duplicate tool IDs  
- Extend `provider-sdk` interfaces from `@shotbro/ai/providers/types` when media adapters land  
