# Phase 5K — Production regression RCA (regression-strict 8/8)

**Date:** 2026-10-28  
**VPS:** `85.117.235.93`  
**Baseline failure log:** `/var/log/shotbro-e2e/phase5k-acceptance-41e3f8bc.log`  
**Code at failure:** `41e3f8bc` (API), `23b00c83` (Web)

## Summary

| Item | Finding |
|------|---------|
| **Common root cause (all 8)** | Production bootstrap chat never reached **AgentRuntime / ProductionOrchestrator** — stuck after **creative-turn** path |
| **First broken transition** | **Chat → production plan**: assistant never posted `generation_plan` / Brief (MOCK) |
| **Not root cause** | Worker FFmpeg, MP4 delivery, queue deadlock (runs failed before enqueue) |

## Per-scenario matrix (8 failures)

All eight tests share the **same failure signature** (viewport-only duplicates):

| # | Test | Last successful step | First error | Exit |
|---|------|----------------------|-------------|------|
| 1–2 | desktop phase3 + phase4 | User message POST; `waitForAgentRunPersisted` (≥1 run) | `waitForMockBriefVisible` / `waitForPhase4AgentSignalVisible` — no `generation_plan` in API messages (180s) | Playwright predicate timeout |
| 3–4 | desktop1440 | same | same | same |
| 5–6 | tablet | same | same | same |
| 7–8 | mobile | same | same | same |

**ProjectId / AgentRunId:** not stable in log (fresh project per run); failed runs were **5K-creative** OpenRouter/mock creative turns, not production `createRun` brief pipeline.

**Production state:** DRAFT; no approvals; no production enqueue; **0** delivery MP4.

## Routing defect

With `LLM_LIVE_EXECUTION_ENABLED=true`:

1. Web `shouldTryCreativeTurn()` returned **true** for production bootstrap NL (explicit line for bootstrap).
2. Web called **`POST …/agent/creative-turn`** first.
3. Server **`shouldUseMockCreativePlanner()`** was **false** → **`runCreativeLlmLoop`** (OpenRouter), **not** `planCreativeIntent()`.
4. Mock planner’s `isProductionBootstrap → null` applied only on **mock** path — **bypassed under live LLM**.
5. Fallback **`createRun`** ran only on `creative.status === "no_intent"` — live LLM never returned `no_intent` for bootstrap text within E2E window.
6. Result: creative assistant blocks (5K header / tools), **no** `generation_plan` Brief → 8× FAIL at step 1.

**Why 5I/5J passed:** regression ran with **LLM off** or pre-5K web routing; mock planner returned `no_intent` → `createRun` → orchestrator.

**OpenRouter flags impact:** isolated to **creative-turn**; production orchestrator unchanged. Guards did **not** block mock MP4 assembly.

## Fix (routing isolation)

1. **`isProductionBootstrapUserMessage()`** exported; **`CreativeAgentRuntime.runCreativeTurn`** returns **`no_intent` immediately** (no OpenRouter spend).
2. Web: production bootstrap → **`createRun` only**; removed bootstrap from **`shouldTryCreativeTurn`**.

## Verification plan

1. `pnpm --filter @shotbro/ai test` — routing spec.
2. Targeted desktop: `phase3-mock-production.spec.ts` (retries=0).
3. `phase5k-live-llm-smoke.sh` — LLM still PASS, media jobs 0.
4. Full `phase5k-acceptance-e2e.sh` after targeted green.

## Post-fix evidence (`b6e19bf5`)

| Check | Result |
|-------|--------|
| Fix commit | `b6e19bf` — production bootstrap → `no_intent` / direct `createRun` |
| API / Web runtime | **`b6e19bf5`** |
| Worker | **`366716e`** (unchanged) |
| `PHASE5K_LIVE_LLM_SMOKE_PASS` | **PASS** (after deploy) |
| Targeted `phase3-desktop-strict` | **PASS** (22.8s) — `/var/log/shotbro-e2e/phase3-desktop-strict-b6e19bf.log` |
| `regression-strict` 8/8 | **PASS** (9.4m) — log `phase5k-acceptance-34435d98.log` |
| `phase5-user-journey` 4/4 | **PASS** after storyboard poll fix (`34435d9`) |
| Full `phase5k-acceptance-e2e.sh` | _clean rerun_ — `/var/log/shotbro-e2e/phase5k-acceptance-clean.log` (avoid parallel Playwright) |
