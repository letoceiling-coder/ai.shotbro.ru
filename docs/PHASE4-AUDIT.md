# Phase 4 — Repository audit

**Date:** 2026-10-24  
**Baseline tag:** `phase3-rc1` → `e66d480`  
**Branch at audit:** `phase3/agent` @ `abc69a5`  
**Staging `DEPLOYED.txt`:** `66c1d2f`  
**VPS images:** API `21516745c50c`, Worker `376ea777aeeb`, Web `d943d2778efe`

## Verified Phase 3 RC1

| Area | Status |
|------|--------|
| Mock production E2E | **TESTED** (Playwright 4 viewports @ staging) |
| Budget DB tests | **TESTED** (3/3 isolated PostgreSQL) |
| Integration security | **TESTED** |
| Provisioning | **DISABLED** post-RC1 |
| Paid AI calls | **0** |

## Phase 3 assets reused in Phase 4

| Module | Location | Phase 4 use |
|--------|----------|-------------|
| ProductionOrchestrator | `packages/ai/src/production-orchestrator.ts` | Unchanged mock-production path |
| ToolExecutor shell | `packages/ai/src/tool-executor.ts` | Extended catalog + handlers |
| CostReservation | `apps/api` | Financial engine (4C) |
| Model registry (mock) | `packages/ai/src/model-registry.ts` | Router extension |
| OpenRouter stub | `packages/ai/src/providers/openrouter-provider.ts` | Superseded by LLM gateway + adapter |
| Drizzle schema | `packages/db` | Extend with provider_job (planned) |

## Gaps entering Phase 4

| Gap | Priority |
|-----|----------|
| No unified LLM Gateway | **4A** — **IMPLEMENTED** (branch) |
| Tool handlers mostly missing | **4A** — **PARTIAL** (handlers + ADAPTER_PENDING) |
| No provider job persistence table | **4B** — migration **NOT IMPLEMENTED** |
| Frontend production cards | **4C** — **NOT IMPLEMENTED** |
| Live provider verification | **BLOCKED BY POLICY** |
