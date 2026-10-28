# Phase 5L — Product & platform audit

**Date:** 2026-10-29  
**Git baseline:** `ea19bd2` (`phase5/creative-studio`) — Phase **5K ACCEPTED**  
**Scope:** READ-ONLY audit; no runtime changes, no paid media jobs.

---

## 1. Methodology

### 1.1 What “ready” means here

A stage is **not** marked ready because a React component or REST route exists. It must satisfy:

1. **Persisted state** in PostgreSQL (or intentional ephemeral UI-only with documented scope).
2. **REAL mode** path wired (not DEMO-only Zustand).
3. **Recoverability** after F5 (server truth + client rehydration or documented pin pattern).
4. **Verification** — integration test, Playwright `phase5-*`, or `regression-strict` evidence.

### 1.2 Readiness percentages (two lenses)

| Lens | Score | Meaning |
|------|-------|---------|
| **A. Staging mock-complete studio** | **~72%** | REAL workspace, documents, mock production MP4, 5K agent tools, FFmpeg on mock inputs; acceptance suites green at 5K. |
| **B. Commercial “idea → real video” product** | **~38%** | Live image/video/voice generation, unified agent, delivery UX, billing cutover, final product sign-off — largely absent or policy-off. |

**Weighted formula (lens A)** — 12 pipeline stages × weight 1, scored 0–1:

| Score | Definition |
|-------|------------|
| 1.0 | REAL end-to-end, tested, no critical UX gap |
| 0.75 | REAL backend + UI; manual tab switching or weak chat integration |
| 0.5 | Mock/simulated content but real persistence & worker path |
| 0.25 | Partial UI or API-only; tests use bootstrap shortcuts |
| 0.0 | Missing or broken |

Stage scores used in §2 table → **sum/12 ≈ 0.72**.

**Lens B** additionally caps **VIDEO** and **RESULT** at 0.15 until live provider cutover exists, and **AGENT** at 0.55 until single orchestrated journey — blended product score **~38%**.

---

## 2. Pipeline audit (PROJECT → RESULT)

| Stage | Status | Evidence | Gaps / notes |
|-------|--------|----------|--------------|
| **PROJECT** | **WORKING** | `apps/api/src/projects/*`, `use-real-studio.ts`, E2E `real-login.ts` | F5: `activeRealProjectId` in Zustand persist; without pin, wrong project after reload (`real-projects-sidebar.tsx`). |
| **CHAT** | **PARTIAL** | `real-thread.tsx`, `real-composer.tsx`, SSE `use-project-events.ts` | DEMO default (`studio-mode-provider.tsx`); dual routing (`agent-message-routing.ts` vs `creative-intent-planner.ts`); SSE not driving all workspace tabs. |
| **AGENT** | **PARTIAL** | `agent.service.ts` (`createRun`, `creative-turn`), `creative-agent-runtime.ts`, `production-orchestrator.ts` | Two stacks: production bootstrap vs creative NL; live OpenRouter **without** chat history in loop (`creative-llm-loop.ts`); `generate.*` blocked from creative LLM (`media-guard.ts`). |
| **SCRIPT** | **WORKING** | `script-editor.tsx`, `use-creative-documents.ts`, `production.controller.ts` | E2E sometimes **API bootstrap** if UI slow (`phase5-creative-ui.ts` `addScriptScenesViaUI`). |
| **CHARACTERS** | **WORKING** | `character-studio.tsx`, `character-continuity.service.ts`, `phase5-characters.spec.ts` | Memory service not fed into agent context (`project-memory.service.ts` unused in creative tools). |
| **STORYBOARD** | **WORKING** | `storyboard-studio.tsx`, `storyboard-document.service.ts`, `phase5-storyboard.spec.ts` | “Generate video” UI is capability display only — no submit to provider jobs from storyboard button. |
| **FIRST FRAME** | **WORKING** | Tools in `creative-agent-runtime.ts`, UI patch + references, `phase5-agent-integration.spec.ts`, live mutation smoke | Live LLM requires ordinal tool in catalog (`creative-llm-tools.ts`, fixed in `1ff15ac`). |
| **APPROVAL** | **WORKING** | `approvals.service.ts`, `approval-card.tsx`, `PHASE5-APPROVAL-REVISION-INTEGRITY.md`, `regression-strict` | Prompt/timeline revision UX still uneven vs storyboard. |
| **VIDEO (scene media)** | **MOCK** | `production-run.ts`, `graph-planner.ts`, `Phase4Mock*Provider` in `provider-jobs.service.ts` | Fixture bytes only; `MEDIA_GENERATION_ENABLED=false` on staging (`packages/config/src/env.ts`). |
| **TIMELINE** | **WORKING** | `timeline-studio.tsx`, `timeline-document.service.ts`, `phase5-timeline.spec.ts` | Preview labeled mock; no in-browser transcode preview. |
| **ASSEMBLY** | **MOCK** (real FFmpeg) | `timeline-assembly.ts`, `PHASE5-FFMPEG-ASSEMBLY.md`, `phase5-assembly.spec.ts` | Inputs mock/lavfi when `AI_MOCK_MODE=true`; **no assembly section** in UI — API + chat only. |
| **RESULT** | **PARTIAL** | `production-section.tsx`, chat `video_result` block | Worker sets `url: ""` (`production-run.ts` L285–291); user relies on asset download, not inline URL. |

### 2.1 Status legend (summary table)

| Status | Stages |
|--------|--------|
| **WORKING** | PROJECT, SCRIPT, CHARACTERS, STORYBOARD, FIRST FRAME, APPROVAL, TIMELINE |
| **MOCK** | VIDEO, ASSEMBLY (FFmpeg real, content mock) |
| **PARTIAL** | CHAT, AGENT, RESULT |
| **BROKEN** | — (no P0 broken paths on accepted staging) |
| **MISSING** | Unified “one agent” journey; live media product path; scene output gallery; Brief E2E; dedicated Assembly UI |

---

## 3. AI agent audit

### 3.1 OpenRouter & tool calling

| Area | Finding | Files |
|------|---------|-------|
| Live LLM | Works for `creative-turn` when `LLM_LIVE_EXECUTION_ENABLED` + proxy | `openrouter-llm-adapter.ts`, `phase5k-live-llm-smoke.sh` |
| Tool surface | `CREATIVE_LLM_TOOL_IDS` ⊃ OpenAI `buildCreativeOpenAiTools()` — **gap** | `creative-llm-tools.ts` (`reorder_storyboard_scenes`, `update_timeline_clip`, `get_scene_prompt`, … allowlisted but not exposed) |
| Media tools | `generate.image/video/voice` in Phase 4 catalog, **blocked** in creative loop | `tool-executor.ts`, `creative-llm-loop.ts` system prompt |
| Production agent | 7 tools, mock LLM only | `agent-runtime.ts` |
| Memory | Turn session + `project.settings.creativeAgentMemory`; **no** full chat transcript in LLM | `agent.service.ts`, `creative-llm-loop.ts` |

### 3.2 Can the agent lead “idea → video” without manual tabs?

**No (today).** Reasons:

1. Production bootstrap requires **keyword patterns** (`isProductionBootstrapUserMessage`) — not free-form idea (`creative-intent-planner.ts`, `PHASE5K-PRODUCTION-REGRESSION-RCA.md`).
2. Creative path cannot enqueue **mock/live generation** or **`compose_video`** from OpenRouter tool list.
3. UI does not auto-switch `creativeSection` on tool results — user clicks “Открыть в Creative” (`agent-tool-result-card.tsx`).
4. React Query invalidates **messages/runs** after `creative-turn`, not storyboard/timeline/assets (`use-real-studio.ts`).

### 3.3 Security, isolation, idempotency, paid ops

| Mechanism | Status | Files |
|-----------|--------|-------|
| Project IDOR | Enforced on agent, assets, SSE | `access-policy.service.ts`, `security-isolation.integration.spec.ts` |
| Tool idempotency | `(runId, idempotencyKey)` replay | `tool-executor.ts`, `drizzle-production-storage.ts` |
| Provider job idempotency | DB unique `(projectId, idempotencyKey)` | `provider-job-manager.ts`, migration `0005_provider_jobs.sql` |
| Cost holds | On production approval | `cost-reservation.service.ts` |
| Media guard | Blocks paid generation by default | `media-guard.ts`, `phase5k-media-guard-smoke.sh` |
| **Gap** | `creative-turn` body `idempotencyKey` stored, **not** deduped at HTTP | `agent.service.ts` ~212, `CreativeAgentTurnBodySchema` |

---

## 4. UI audit (desktop / tablet / mobile)

| Area | Desktop | Tablet / mobile | Issues |
|------|---------|-----------------|--------|
| Mode discovery | REAL toggle in settings/header | Same; create button visibility fixes in E2E | Default **DEMO** confuses new users (`PHASE5-DEMO-REAL-UX-AUDIT.md`) |
| Chat | Full composer + blocks | Tested in `regression-strict` / journey | Thread resync if SSE missed (`real-ui-sync.ts`) |
| Asset library | Full grid + detail sheet | `phase5-asset-library` viewports | Strong coverage |
| Storyboard / timeline | Full editors | Journey + timeline specs | Timeline inline RQ (not shared hook) |
| Production / result | Section + download | Journey F5 | Mock copy; empty `video_result.url` |
| Brief | Read-only tab | Nav smoke **skips brief** in journey | No dedicated Brief E2E |
| Dead code | — | — | `placeholder-section.tsx` unused; `DemoThread` REAL branch unreachable (`studio-shell.tsx`) |

---

## 5. Production contour audit (no paid runs)

| Component | Architectural readiness | Runtime on staging | Files |
|-----------|----------------------|--------------------|-------|
| Provider adapters | Fal, ElevenLabs, OpenRouter media, Magnific stubs | **Off** (`AI_MOCK_MODE`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`) | `packages/ai/src/providers/*`, `ExecutionPolicyEngine` |
| Mock provider jobs | **Working** | Simulated READY assets | `provider-jobs.service.ts` |
| Production graph | **Working** | Enqueued via orchestrator | `production-graph.service.ts`, `graph-planner.ts` |
| Worker `production.run` | **Working** | Main path | `production-run.ts`, `main.ts` |
| Worker `production.node` | Handler exists | **Never enqueued from API** | `media-queue.service.ts` `enqueueProductionNode` |
| FFmpeg assembly | **Working** | v2 timeline snapshot | `timeline-assembly.ts` |
| Cost estimate / reserve | **Working** (mock estimate) | Holds on approve | `production-orchestrator.ts`, cost service |
| Live cutover UI | **Missing** | “Live execution disabled” copy | `model-settings-section.tsx`, `storyboard-studio.tsx` |

---

## 6. Tests & documentation drift

| Artifact | State |
|----------|--------|
| Phase 5K acceptance | **ACCEPTED** — `PHASE5-AGENT-INTEGRATION-ACCEPTANCE.md` |
| `phase5k-acceptance-e2e.sh` | 12 suites including creative-flow, assembly |
| `PHASE5-FINAL-ACCEPTANCE.md` | Still **NOT IMPLEMENTED** (predates 5I–5K completion) |
| `PHASE5-REMAINING-WORK.md` | **Stale** (claims 5I not started; contradicted by `PHASE5-PROGRESS.md`) |
| `PHASE5-AGENT-INTEGRATION-ARCHITECTURE.md` | Header still “NOT ACCEPTED” — doc drift |

---

## 7. Blocking problems (P0 product)

1. **Split brain agent** — production orchestrator vs creative-turn; no unified planner for free-form “сделай ролик”.
2. **Mock-only video** — no product path to live generation (by policy) and no staged “enable mock jobs from UI” parity for scene gallery.
3. **Workspace desync after chat** — user must change tabs / reload to see agent mutations.
4. **Weak delivery UX** — `video_result.url` empty; assembly invisible in UI.
5. **Final product sign-off** — no single Phase 5 “final acceptance” gate aligned with current reality.

---

## 8. Architectural risks

| Risk | Impact |
|------|--------|
| Routing regressions (bootstrap vs OpenRouter) | Production MP4 chain fails silently (historical 8/8 failure — `PHASE5K-PRODUCTION-REGRESSION-RCA.md`) |
| Tool catalog / allowlist drift | LLM calls disallowed tools or misses ordinal tools |
| Disk / deploy preflight on VPS | Blocked deploy at ≥90% used (observed during 5K sync) |
| Dual worker paths (`production.run` vs `production.node`) | Confusion, dead code, wrong future optimizations |
| DEMO default | Support burden, false “product broken” reports |
| Enabling live media without gates | Cost + security incident (`main.ts` blocks OpenRouter + `MEDIA_GENERATION_ENABLED`) |

---

## 9. What full user scenario still requires

1. Clear **REAL-first** onboarding (or post-login default REAL for authenticated users).
2. **One conversational flow** covering script → frames → approvals → timeline → delivery (even if media stays mock).
3. **Automatic workspace refresh** when agent/tools mutate documents.
4. **Result playback** (signed URL or `/assets/:id/preview`) in chat and Production tab.
5. **Scene-level job/status gallery** (mock provider jobs first).
6. **HTTP idempotency** for creative-turn retries.
7. Optional later: **live media cutover** behind approvals, budget, and `ExecutionPolicyEngine.LIVE_APPROVED`.

---

## 10. Recommended Phase 5L scope (preview)

See **`PHASE5L-TECHNICAL-SPEC.md`** — theme: **“Unified REAL studio coherence”** (agent + UI + delivery), **not** live paid video launch.

**After 5L (still out of band):** live provider cutover, Magnific upscale UI, SSE-driven multi-tab live editing, `PHASE5-FINAL-ACCEPTANCE` green on all viewports with explicit live-media policy document.
