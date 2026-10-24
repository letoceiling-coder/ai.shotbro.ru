# Phase 4F — Delivery root cause (staging investigation)

**Date:** 2026-10-25  
**Environment:** https://ai.shotbro.ru · VPS staging Postgres / worker / MinIO  

## Failed run (Phase 3 desktop strict, ~2026-10-24 21:39 UTC)

| Field | Value |
|-------|--------|
| projectId | `0500f370-3742-4b3e-8e56-161b75096511` |
| project title | `E2E mvmx8l1z` |
| runId | `d020ad0d-b5be-4171-98ac-202cfafd5270` |
| conversationId | `9dd586ee-9a0b-451f-9103-85a50cc7e931` (from run metadata) |
| traceId | `8cfef3a0-8258-4f59-bbb3-e4f02bcbbeed` |

Log: `/tmp/regression-strict-3b31be8.log` · trace: `apps/web/test-results/phase3-mock-production-Pha-5026c-*-desktop/trace.zip`

## Timeline (PostgreSQL)

| Step | Time (UTC) | Evidence |
|------|------------|----------|
| Project created | 21:39:06 | `project.created_at` |
| Agent run created | 21:39:07 | `agent_run` |
| PLAN approval decided APPROVED | 21:39:07.747 | `approval` row `27e95393-…` |
| Run state | 21:39:07.82 | `production_state = WAITING_SCRIPT_APPROVAL` (unchanged since) |
| SCRIPT approval | — | `77ef904f-…` **PENDING** (never decided) |
| MP4 poll in E2E | up to +600s | `waitForMockMp4Asset` → false |

## Last successful / first failed stage

| | Stage |
|---|--------|
| **Last successful** | PLAN gate approved; orchestrator moved to **SCRIPT** wait |
| **First failed** | **SCRIPT approval never submitted** → run never resumed → **no production enqueue** |

## Root cause (confirmed)

**Not** worker, FFmpeg, MinIO, or AssetService.

The strict E2E helper exited the approval loop when no enabled «Утвердить» button was visible **between** gates (PLAN decided → UI/SSE lag before SCRIPT card). PostgreSQL shows **SCRIPT still PENDING**; `metadata.productionEnqueued` never set; **no `production.run` BullMQ job** for this run.

Classification: **approval gate transition + E2E synchronization** (situation D avoided — asset name was correct; asset never created because production never started).

## Backend / worker evidence

- **AgentRun:** `status=RUNNING`, `production_state=WAITING_SCRIPT_APPROVAL`, `runtimeVersion=4` in metadata.
- **Approvals:** PLAN APPROVED; SCRIPT PENDING.
- **Production graph:** not built (no enqueue).
- **BullMQ `production.run`:** no job for this runId (nothing to consume).
- **Worker logs:** no FFmpeg/assembly for this runId in the failure window.

## Fix

1. **E2E** `approvePendingApprovals(page, projectId)` — repeat UI «Утвердить» until **`GET /api/v1/projects/:id/approvals`** has **zero PENDING**. After each click, wait for **APPROVED count to increase** (not raw pending count — SCRIPT appears when PLAN is decided).
2. **`waitForProductionEnqueued`** — assert `productionEnqueued` or `QUEUED`/`PRODUCING`/`COMPLETED` before MP4 poll.

No API/worker redeploy required for this root cause.

## Post-fix proof (2026-10-24 22:36 UTC)

| Check | Result |
|-------|--------|
| projectId | `4822ccf8-ccf9-4053-9cb3-1f15928eddc5` |
| runId | `03f8a153-a7f2-451b-9e44-d3703b500620` |
| All approvals | PLAN→PRODUCTION **APPROVED** |
| Run terminal | **COMPLETED** (~5s) |
| `productionEnqueued` | **true** |
| `deliveryAssetId` | present in metadata |
| Phase 3 desktop strict | **PASS** 10.6s (`3a7c978`) |

## Versions at investigation

| Component | SHA |
|-----------|-----|
| Web (live) | `9c22914` |
| API/worker images | `4b127c7` (staging compose build tags) |
| Git remote | `ce4d3df` + delivery fixes pending push |

## Verification plan

1. `staging-investigate-run.sh <projectId>` after one Phase 3 smoke — expect all approvals APPROVED, `productionEnqueued`, mock-delivery asset row.
2. `phase3-desktop-strict` → full `regression-strict` (retries=0, workers=1).

## Policy

Mock-only · no paid AI · no production cutover.
