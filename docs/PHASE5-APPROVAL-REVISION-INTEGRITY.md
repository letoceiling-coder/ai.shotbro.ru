# Phase 5 — Approval revision integrity (Storyboard Sync)

**Status:** Implemented 2026-10-27 · staging deploy pending verification

## Root cause (P0 user journey r2–r4)

1. **Sync script** on Storyboard Studio publishes a **new** `STORYBOARD` document (`targetId` + `version`).
2. Chat still showed a **PENDING** approval card bound to the **previous** document hash/version.
3. UI click approved the stale row; `ProductionOrchestrator.checkWaitingApproval()` validates the **active** document → still not approved.
4. Run stayed in `WAITING_STORYBOARD_APPROVAL` with **no new PENDING** row (orchestrator only calls `requestApproval` on gate entry, not on revision).

E2E workaround (removed in r5): skip Sync script. Product fix required for real users.

## Fix

| Layer | Change |
|-------|--------|
| API `StoryboardDocumentService` | Idempotent `syncFromScript` when script version + scenes unchanged (`revised: false`). |
| API `ApprovalsService` | `expirePendingForTargetTypes(STORYBOARD, COST, PRODUCTION)` on revision. |
| API `AgentService` | `onStoryboardDocumentRevised` — rewind in-flight runs to `WAITING_STORYBOARD_APPROVAL`, `refreshWaitingGateRequest`. |
| API `ProductionController` | After sync / scene patch / reorder → notify agent when `revised !== false`. |
| `@shotbro/ai` orchestrator | `refreshWaitingGateRequest`, storyboard approval description for re-approval. |
| Web `ApprovalCard` | Surface version mismatch (409) as «Нужны правки» state. |
| Worker | Mark run `FAILED` when `production.run` job throws (avoid infinite `PRODUCING`). |

## Dependency graph (unchanged)

`SCRIPT → STORYBOARD → (creative tabs) → TIMELINE → COST → PRODUCTION`

Storyboard revision invalidates **pending** downstream approvals and re-opens the storyboard gate for **non-terminal** runs (`PRODUCING` / `COMPLETED` untouched).

## E2E

`phase5-user-journey.spec.ts`: first STORYBOARD UI approve → Sync + scene edit → second UI approve → idempotent Sync (no extra PENDING).

## Regression r4 RCA (Phase 3/4)

| Class | Finding |
|-------|---------|
| E | All 8 tests: `PRODUCING` 600s — worker assembly / empty timeline clips (`timeline_no_video_clips`), run not marked FAILED. |
| Not C | API approval helpers; failures after enqueue. |

Mitigation: `ensureTimelineForProduction` + worker FAILED state. Re-run `regression-strict` after API/worker deploy.

## Verification checklist

- [ ] Storyboard sync + re-approve REAL UI path
- [ ] `phase5-user-journey` PASS with Sync steps
- [ ] `regression-strict` 8/8
- [ ] Phase 5 module suites
- [ ] Runtime SHA recorded on VPS
