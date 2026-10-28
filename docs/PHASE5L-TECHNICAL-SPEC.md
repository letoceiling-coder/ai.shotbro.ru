# Phase 5L — Technical specification

**Codename:** Unified REAL Studio Coherence  
**Status:** SPEC ONLY — **implementation not started**  
**Baseline git:** `ea19bd2` (Phase 5K ACCEPTED)  
**Branch target:** continue `phase5/creative-studio` or `phase5/unified-studio` (TBD at kickoff)

---

## 1. Goal & user outcome

### 1.1 Goal

Close the gap between **accepted Phase 5K** (creative agent tools + mock production) and a **coherent REAL studio** where a user can go from project creation through **mock delivery MP4** with minimal manual tab hunting, predictable chat routing, and visible production results.

### 1.2 Expected user outcome (staging, mock media)

Authenticated user in **REAL** mode can:

1. Create/open a project and stay on it after F5.
2. Use chat (production bootstrap **or** guided creative commands) without misrouting to the wrong agent path.
3. See storyboard/timeline/asset changes **without** manually guessing which tab refreshed.
4. Complete mock production and **play or download** the final MP4 from Production tab and chat `video_result`.
5. Inspect per-scene provider job status (mock jobs) from Production or a scene gallery.

**Explicit non-goal:** turning on live Fal/OpenRouter **paid** image/video generation on staging (remains policy-off unless separate cutover phase).

---

## 2. Scope

### 2.1 In scope (Phase 5L)

| ID | Deliverable | Rationale (audit ref) |
|----|-------------|------------------------|
| **5L-1** | **Intent router v2** — documented rules + tests; reduce `no_intent`/bootstrap collisions | `PHASE5K-PRODUCTION-REGRESSION-RCA.md`, `agent-message-routing.ts` |
| **5L-2** | **Creative LLM tool parity** — every `CREATIVE_LLM_TOOL_IDS` entry exposed in `buildCreativeOpenAiTools()` with descriptions | `creative-llm-tools.ts` gap list |
| **5L-3** | **`creative-turn` HTTP idempotency** — `IdempotencyService` on `(userId, projectId, idempotencyKey)` | `agent.service.ts` gap |
| **5L-4** | **Workspace query invalidation** — after `creative-turn` / tool posts, invalidate storyboard, timeline, assets, references, prompts keys | `use-real-studio.ts` |
| **5L-5** | **Optional auto-nav** — configurable: open relevant `creativeSection` on successful `agent_tool_result` (respect user preference) | `agent-tool-result-card.tsx`, `studio-store.ts` |
| **5L-6** | **Delivery UX** — populate `video_result` with preview URL; Production section inline player | `production-run.ts` L285–291, `production-section.tsx` |
| **5L-7** | **Scene / job gallery** — UI listing `provider_job` + graph node status per scene (mock data) | `provider-jobs.service.ts`, `context-panel` / new component |
| **5L-8** | **Brief tab smoke** — E2E asserts brief visible after bootstrap | `brief-section.tsx`, journey gap |
| **5L-9** | **Assembly affordance** — UI button calling `POST .../timeline/prepare-assembly` where timeline valid (not chat-only) | `phase5-assembly.spec.ts` API-only pattern |
| **5L-10** | **Doc reconciliation** — update `PHASE5-FINAL-ACCEPTANCE.md`, archive/fix `PHASE5-REMAINING-WORK.md`, sync `PHASE5-AGENT-INTEGRATION-ARCHITECTURE.md` header | §6 product audit |
| **5L-11** | **Remove or wire dead paths** — decide: delete `production.node` enqueue API or document single path; remove unused `placeholder-section.tsx` | `media-queue.service.ts`, `production-node.ts` |

### 2.2 Out of scope (Phase 5L)

- Enabling **`MEDIA_GENERATION_ENABLED`** / live Fal video on production staging.
- OpenRouter **media** adapters in production graph.
- Magnific upscale UI (`PHASE5-MAGNIFIC-INTEGRATION.md` backlog).
- Full **chat transcript** in every OpenRouter turn (may be 5M/5N).
- Replacing **ProductionOrchestrator** mock content with LLM-authored brief/script.
- Multi-tenant billing productization beyond existing cost holds.
- Phase 6+ features not listed in Phase 5 architecture.

---

## 3. Priorities

| Priority | Items | Rationale |
|----------|-------|-----------|
| **P0** | 5L-1, 5L-4, 5L-6, 5L-3 | User-visible coherence + routing safety + retry safety |
| **P1** | 5L-2, 5L-5, 5L-7, 5L-8, 5L-9 | Agent completeness, discovery, test coverage |
| **P2** | 5L-10, 5L-11 | Hygiene, maintainability |

---

## 4. Architecture changes

### 4.1 Chat routing layer (5L-1)

**Current:** `apps/web/src/lib/agent-message-routing.ts` + server `isProductionBootstrapUserMessage()`.

**Target:**

- Single module **`studio-intent.ts`** (web) mirroring server rules (import shared predicate from `@shotbro/ai` or duplicate with contract tests).
- Explicit **`IntentDecision`**: `production_bootstrap` | `creative_nl` | `clarify` (future).
- **`clarify`** returns assistant message instead of silent `createRun` fallback when message is ambiguous (optional P1).

**Server:** keep bootstrap guard in `creative-agent-runtime.ts` (no regression).

**Tests:**

- `packages/ai/test/agent-routing.spec.ts` extended.
- New `apps/web/src/lib/studio-intent.test.ts` (vitest).

### 4.2 Creative tool catalog (5L-2)

**Change:** Add missing OpenAI function defs in `buildCreativeOpenAiTools()`:

- `reorder_storyboard_scenes`
- `update_timeline_clip`
- `get_scene_prompt`
- `get_production_status`
- `get_approval_status`

**Validation:** snapshot test of tool names ⊆ allowlist.

### 4.3 Idempotency (5L-3)

**Change:** Wrap `runCreativeTurn` handler:

```text
IdempotencyService.run(
  key = `creative-turn:${projectId}:${idempotencyKey}`,
  ttl = 24h,
  fn = existing turn logic
)
```

**Files:** `agent.service.ts`, `idempotency.service.ts`, migration if new table rows need index (reuse existing idempotency store).

**Tests:** integration — duplicate POST returns same body, single side effect.

### 4.4 Client cache coherence (5L-4)

**Change:** Central **`invalidateCreativeProjectQueries(queryClient, projectId)`** calling:

- `['storyboard', projectId]`, `['timeline', projectId]`, `['assets', projectId]`, `['references', projectId]`, `['prompts', projectId]`, `['agent-runs', projectId]`, `['messages', ...]`.

**Hook:** `use-real-studio.ts` after successful `creative-turn`.

**Optional:** subscribe SSE event types to same invalidator (`use-project-events.ts`).

### 4.5 Delivery block (5L-6)

**Worker/API:** When posting `video_result`, set `url` to **presigned GET** or web-relative **`/api/v1/assets/:id/preview`** (consistent with asset library).

**Files:** `production-run.ts`, possibly `assets.controller.ts` preview route, `message-block-renderer.tsx` video player.

**Security:** same access policy as asset download.

### 4.6 Scene job gallery (5L-7)

**UI:** New panel section or Production subsection: list jobs from `GET /api/v1/projects/:id/provider-jobs` with scene linkage from graph metadata.

**Mock-first:** display `mock: true` badge; no live submit button on staging.

---

## 5. Modules touched

| Layer | Paths |
|-------|--------|
| Web | `apps/web/src/hooks/use-real-studio.ts`, `lib/agent-message-routing.ts`, `components/chat/blocks/*`, `components/creative/sections/production-section.tsx`, new `scene-jobs-panel.tsx` (name TBD) |
| API | `apps/api/src/agent/agent.service.ts`, `apps/api/src/common/idempotency.service.ts` |
| Worker | `apps/worker/src/production-run.ts` (delivery payload only) |
| AI package | `packages/ai/src/agent/creative-llm-tools.ts` |
| Contracts | `packages/contracts/src/blocks.ts` (`video_result.url` optional → required for REAL) |
| Docs | See 5L-10 |
| E2E | New/extended `phase5-unified-studio.spec.ts` or extend `phase5-user-journey.spec.ts` |

---

## 6. API & migrations

| Change | Migration? |
|--------|------------|
| Idempotency keys for creative-turn | **No** if reusing `idempotency_record` table |
| `video_result` payload schema | **No** DB — message_block JSON only |
| New index on provider_job for scene filter | **Optional** — only if gallery queries slow |

No destructive schema changes planned.

---

## 7. Dependencies & risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Phase 5K routing fixes | Regression 8/8 | Mandatory `regression-strict` on every 5L PR |
| OpenRouter live on staging | Cost / misroute | Keep media off; optional live NL tests unchanged |
| VPS disk | Deploy block | Pre-deploy `staging-safe-cleanup.sh --confirm` |
| React Query key consistency | Stale UI if keys wrong | Single invalidation helper + E2E polling |

---

## 8. Implementation plan (sub-phases)

### 5L-A — Safety & routing (P0) — ~1 sprint

1. 5L-1 intent router + tests  
2. 5L-3 creative-turn idempotency  
3. Run `regression-strict` + `phase5-agent-integration`

### 5L-B — Workspace coherence (P0/P1) — ~1 sprint

1. 5L-4 query invalidation (+ SSE hook optional)  
2. 5L-5 auto-nav (feature flag `CREATIVE_AUTO_DEEP_LINK=true` in web env)  
3. 5L-6 delivery URL + player

### 5L-C — Production visibility & acceptance (P1/P2) — ~1 sprint

1. 5L-7 scene job gallery  
2. 5L-8 brief E2E  
3. 5L-9 assembly button  
4. 5L-10 docs  
5. 5L-11 dead path cleanup  
6. Full **`phase5l-acceptance-e2e.sh`** (see acceptance plan)

---

## 9. Verification matrix (summary)

Detailed criteria: **`PHASE5L-ACCEPTANCE-PLAN.md`**.

| Area | Minimum bar |
|------|-------------|
| Regression | `regression-strict` 8/8, retries=0 |
| 5K smokes | media guard, live LLM, live mutation (unchanged pass) |
| New E2E | Unified journey spec green desktop + spot tablet |
| Security | IDOR tests unchanged; idempotency integration test added |
| Media | **0** live provider jobs on staging acceptance run |

---

## 10. What remains after Phase 5L

- **Live media cutover phase** (tentative 5M): flags, UI, `ProviderJobsService` live adapters, approval + budget gates.
- **Full LLM production authoring** (brief/script from OpenRouter in orchestrator).
- **SSE-driven multi-tab** real-time editing without reload.
- **Magnific / upscale** and advanced provider routing (`PHASE5-MULTIPROVIDER-ARCHITECTURE.md`).
- **Commercial readiness:** billing, quotas, observability SLOs.
- **PHASE5-FINAL-ACCEPTANCE** expanded to include live-media policy document (separate gate).

---

## 11. Relation to old “5L Approval Dependencies”

Historical roadmap (`PHASE5-REMAINING-WORK.md`) labeled 5L as approval dependencies. Much of that landed in **5I–5K** (`PHASE5-APPROVAL-REVISION-INTEGRITY.md`). **This 5L redefines** the milestone as **studio coherence + delivery UX + agent/tool parity**, which is the current critical path to a demo-ready product on mock media.
