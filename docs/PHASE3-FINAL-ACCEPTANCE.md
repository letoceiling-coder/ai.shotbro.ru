# Phase 3 — Acceptance report (in progress)

**Branch:** `phase3/agent`  
**Git HEAD:** `3ab3c22` (`phase3: complete mock pipeline backend and REAL UI hook`)  
**Staging DB migrations:** `0001_third_tigra`, `0002_square_makkari` — **TESTED** — [PHASE3-MIGRATION-STAGING.md](./PHASE3-MIGRATION-STAGING.md)  
**Staging code deploy:** **DEPLOYED** 2026-10-24 — api/worker/web rebuilt from tarball `3ab3c22`

## Executive summary

| Area | IMPLEMENTED | TESTED | DEPLOYED |
|------|-------------|--------|----------|
| ProductionOrchestrator + approvals auto-resume | ✓ | partial | pending |
| Production graph + `production.run` worker | ✓ | unit | pending |
| Mock assets → MinIO | ✓ | local typecheck | pending |
| FFmpeg local MP4 assembly | ✓ | worker logic | pending |
| REAL UI agent trigger | ✓ | e2e skeleton | pending |
| Cost reservation | ✓ | — | pending |
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
| Playwright `phase3-mock-production.spec.ts` | **NOT RUN** in this session |
| Integration agent/approval | **NOT IMPLEMENTED** |

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
5. CharacterContinuityService, PromptVersion API, Production Board UI cards.
