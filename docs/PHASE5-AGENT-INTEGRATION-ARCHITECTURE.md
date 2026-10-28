# Phase 5K — Agent Integration architecture

**Status:** NOT ACCEPTED — routing fix deployed; full acceptance in progress  
**Branch:** `phase5/creative-studio` · **Git:** `b6e19bf`

## 1. Audit summary (2026-10-28)

### Runtime baseline (VPS `85.117.235.93`)

| Item | Value |
|------|--------|
| Git checkout (VPS src) | `b6e19bf` |
| API image label | `b6e19bf` — creative + production routing isolation |
| Web image label | `b6e19bf` — bootstrap → `createRun` |
| Worker | `366716e` |

### OpenRouter egress

- Datacenter direct → OpenRouter **403** (security policy).
- Staging uses **`OPENROUTER_HTTPS_PROXY`** with `OPENROUTER_CONNECT_MODE=auto`.
- Multi-turn tool results require OpenAI-shaped assistant `tool_calls` (`creative-llm-loop` + adapter).

### Chat routing (production vs creative)

| User intent | Path |
|-------------|------|
| Mock production bootstrap («рекламный ролик 15 сек TestCo») | Web **`createRun`** → AgentRuntime → ProductionOrchestrator (creative-turn returns **`no_intent`** immediately on API) |
| Creative NL (`phase5k:`, library, frames, timeline) | **`creative-turn`** → mock planner or OpenRouter |
| Default / ambiguous | **`createRun`** after `no_intent`, or production path |

See `isProductionBootstrapUserMessage()` in `creative-intent-planner.ts` and `apps/web/src/lib/agent-message-routing.ts`.

### Core components

| Component | Location | Role today | 5K gap |
|-----------|----------|------------|--------|
| **AgentRuntime** | `packages/ai/src/agent/agent-runtime.ts` | Mock LLM loop; **7 tools** in `allowedTools` (brief/plan/script/storyboard/cost/approval) | Phase 5 creative tools **registered but not routed** by LLM |
| **CreativeAgentRuntime** | `creative-agent-runtime.ts` | Mock planner **or** `runCreativeLlmLoop` (OpenRouter) | LLM when `LLM_LIVE_EXECUTION_ENABLED=true` |
| **OpenRouterLlmAdapter** | `openrouter-llm-adapter.ts` | Chat completions + `tools` / `tool_calls` | Policy `CREATIVE_LLM_LIVE` |
| **Media guard** | `packages/config/src/media-guard.ts` | Blocks `generate.*` unless explicit flags | Default **blocked** |
| **ToolExecutor** | `packages/ai/src/tool-executor.ts` | Zod validate, idempotency, DB audit via `ProductionStoragePort` | OK |
| **Tool catalog** | `phase4-tool-catalog.ts` + handlers | ~50 tools declared; handlers in `register.ts`, `phase5-*-tools.ts` | Composite 5K tools added |
| **ToolRegistry (legacy)** | `tool-registry.ts` | Phase 2 builtins; **not** used by AgentRuntime | Ignore for 5K |
| **AgentService** | `apps/api/src/agent/agent.service.ts` | `createRun` → AgentRuntime v4 + **ProductionOrchestrator** | **`POST creative-turn`** for NL creative |
| **Delegates** | `agent-tool-delegates.ts` | Wire tools → Assets, Storyboard, References, Prompts, Timeline, Approvals | **`searchAssets`** via `listLibrary` |
| **ProjectMemoryService** | `production/project-memory.service.ts` | DB-backed memory for production docs | Not yet used as agent session (turn session in-memory in CreativeAgentRuntime) |
| **AssetsService** | `assets/assets.service.ts` | `listLibrary`, enrichment, IDOR guards | Agent uses library search delegate |
| **StoryboardDocumentService** | `storyboard-document.service.ts` | Revisions, `patchScene`, sync | Used by tools + approval rewind |
| **PromptVersionService** | `prompt-version.service.ts` | Versioned bundles | `save_scene_prompt` / improve tool |
| **TimelineDocumentService** | `timeline-document.service.ts` | Clips, revision, assembly prep | Timeline tools |
| **ApprovalsService** | `approvals.service.ts` | Gates + expire | Triggered on storyboard revise after agent frame set |
| **ProductionOrchestrator** | `production-orchestrator.ts` | Mock production pipeline | Unchanged; not invoked on `creative-turn` |
| **RealThread / RealComposer** | `apps/web/src/components/chat/*` | POST message + agent routing | Creative vs production bootstrap split |
| **Message blocks** | `packages/contracts/src/blocks.ts` | Demo-heavy cards | **`agent_tool_result`** (REAL payload, mock agent label) |

### Intent → tool matrix (target NL)

| User intent (RU) | Tool(s) | API / service | DB | UI | Verification |
|------------------|---------|---------------|-----|-----|--------------|
| Материалы проекта | `search_project_assets`, `list_project_assets` | AssetsService | `asset` | Asset Library | List + cards |
| Первый кадр сцены N | `sync_storyboard_from_script`, `search_project_assets`, `set_scene_first_frame_by_ordinal` | Storyboard + Reference | storyboard doc, reference links | Storyboard | API `firstFrameAssetId` |
| STYLE / LAST_FRAME | `attach_reference`, `set_scene_last_frame` | ReferenceService | reference rows | References | E2E 5F patterns |
| Улучши video prompt | `improve_scene_video_prompt` | PromptVersionService | prompt versions | Prompt Studio | `/prompts/latest` |
| Модель / стоимость | `compare_models`, `get_scene_model_capabilities`, `estimate_cost` | model-router + cost engine | COST_ESTIMATE doc | cost/model cards | Chat blocks |
| Timeline clip video | `create_timeline_from_storyboard`, `assign_video_to_scene_clip` | TimelineDocumentService | timeline revision | Timeline | clip `assetId` |
| Production bootstrap | `createRun` orchestrator | AgentService | agent_run, documents | Chat plan/approvals | regression-strict |

### Tools registered but previously **not** agent-routed

All Phase 5 handlers in `phase5-creative-tools.ts`, `phase5-prompt-tools.ts`, `phase5-timeline-tools.ts` — available to **CreativeAgentRuntime** via deterministic planner (`creative-intent-planner.ts`), not live LLM.

### Duplicates / legacy

| Avoid | Use instead |
|-------|-------------|
| Direct SQL from agent | Domain services via delegates |
| `ToolRegistry` (Phase 2) | `PHASE4_TOOLS` + ToolExecutor |
| `prepare_timeline` legacy script scenes | `get_timeline` + versioned document |
| Fake chat “Готово” without tool row | `toolExecution` + `agent_tool_result` blocks |

## 2. Execution model

```
User NL (chat)
  → RealComposer → POST message
  → POST /agent/creative-turn (if creative intent)
  → planCreativeIntent (mock, deterministic)
  → ToolExecutor (idempotency per runId:creative:step)
  → Delegates → PostgreSQL
  → postAssistantBlocks (text + agent_tool_result)
  → Creative Workspace (deep link via studio store)
```

Production messages (`ролик` + `15`/`TestCo`/…) still use **`POST /agent/runs`** + orchestrator.

## 3. Security & approvals

- Project access on every delegate (`AccessPolicyService`).
- Asset search respects project scope; FAILED/foreign assets rejected in tools.
- Storyboard mutations call `onStoryboardDocumentRevised` → expire downstream approvals (same as UI).
- No `EXTERNAL_PAID` tool execution on staging (`AI_MOCK_MODE`).
- Mock agent labeled **`mockAgent: true`** in API and UI badges.

## 4. Chat UI

| Block | Purpose |
|-------|---------|
| `agent_tool_result` | Per-tool success/fail, summary, deep link |
| `text` | Turn header (mock agent disclaimer) |
| Existing approval/cost blocks | Unchanged for production path |

## 5. E2E

- Spec: `apps/web/e2e/phase5-agent-integration.spec.ts`
- Runner mode: `phase5-agent-integration`
- Trigger token: `phase5k` in user message for stable tool chain

## 6. Remaining work (5K → ACCEPTED)

- [ ] VPS deploy + green agent integration E2E
- [ ] Full regression bundle after 5K
- [ ] Richer NL coverage (disambiguation UI, ordinal context memory)
- [ ] Optional: wire live LLM to same tool allowlist (future)
- [ ] API Docker label pin (non-blocking)
