# Phase 3 — Acceptance report (in progress)

**Branch:** `phase3/agent`  
**Git HEAD (local WIP):** uncommitted on `phase3/agent` atop `81d369b` — adds `WAITING_PRODUCTION_APPROVAL`, cost reserve timing, worker idempotency, Production Board UI  
**Staging DB migrations:** `0001`, `0002` applied manually; **`0003_production_approval_state`** — **PENDING on staging** (enum value only)  
**Staging code deploy:** prior deploy `3ab3c22` — **redeploy required** for this integration batch

## Executive summary

| Area | IMPLEMENTED | TESTED | DEPLOYED |
|------|-------------|--------|----------|
| ProductionOrchestrator + approvals auto-resume | ✓ (+ PRODUCTION gate) | partial | pending |
| Production graph + `production.run` worker | ✓ | unit | pending |
| Mock assets → MinIO | ✓ | local typecheck | pending |
| FFmpeg local MP4 assembly | ✓ | worker logic | pending |
| REAL UI agent trigger | ✓ | e2e skeleton | pending |
| Cost reservation (post-COST, pre-PRODUCTION) + release on cancel/reject | ✓ | 1 integration (skip without env) | pending |
| Script scene PATCH | ✓ | — | pending |

**Verdict:** Backend mock pipeline **not yet end-to-end verified on staging**. Phase 3 **not complete** until Playwright full path + deployed images.

## Flags (mandatory)

```dotenv
OPENROUTER_ENABLED=false
OPENROUTER_ALLOW_PAID_REQUESTS=false
PROVIDER_LIVE_EXECUTION_ENABLED=false
AI_MOCK_MODE=true
```

**Real AI inference calls:** 0 (by design)  
**Paid image/video/TTS:** 0

## Tests recorded

| Suite | Result |
|-------|--------|
| `@shotbro/ai` unit | 9/9 pass |
| API `tsc` | pass |
| Worker `tsc` | pass |
| Playwright `phase3-mock-production.spec.ts` | extended (full approve chain) — **NOT RUN** on staging in this session |
| Integration agent/budget idempotency | `agent-production.integration.spec.ts` (skipped unless `INTEGRATION_API_URL`) |

## API (Phase 3 additions)

- `POST /api/v1/projects/:id/agent/runs`
- `POST .../agent/runs/:runId/resume|pause|cancel`
- `GET .../memory`, `PATCH .../memory`
- `GET .../production-graph`
- `POST .../cost/reserve`
- `GET .../brief`
- `PATCH .../scripts/scenes/:sceneId`

## Remaining blockers

1. Staging Docker rebuild (api, worker with ffmpeg, web).
2. Full Playwright path through all approvals → delivery MP4.
3. Integration tests (isolation, budget race, DAG idempotency).
4. Tool executor: full handler matrix (partial catalog only).
5. Tool executor: full handler matrix (partial catalog only).
6. CharacterContinuityService + PromptVersion API — **minimal REST added**; not wired into graph planner yet.
7. Staging: apply migration `0003`, redeploy, run full Playwright + verify MP4.
