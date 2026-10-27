# Phase 5 — Approval revision integrity (Storyboard Sync)

**Status:** **ACCEPTED** on staging 2026-10-27 · API/worker **6aaab0a** · web **3eb89d3** · git **3eb89d3**

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

- [x] Storyboard sync + re-approve REAL UI path (`onStoryboardDocumentRevised`)
- [x] `phase5-user-journey` **4/4 PASS** — log `phase5-user-journey-b68527c.log` (Sync + scene edit + idempotent sync)
- [x] `regression-strict` **8/8 PASS** — log `regression-strict-6aaab0a.log` (~9.4m)
- [x] Full Phase 5 module suites — `phase5i-signoff-suites.log` → **ALL_PASS**
- [x] Runtime SHA: API/worker **6aaab0a**, web **3eb89d3**, git **3eb89d3**

## Approval UX (web 3eb89d3)

- `ApprovalCard` loads `/api/v1/projects/:id/approvals` and maps **EXPIRED** → badge «Устарело», `data-approval-status="expired"`, disabled buttons.
- Hint when stale: «Версия документа изменилась — подтвердите актуальную карточку ниже.»
- Playwright uses **`.last()`** pending card so stale DOM above does not mask the active gate.

## Active production snapshots

| Run state when storyboard revises | Behavior |
|---------------------------------|----------|
| `WAITING_STORYBOARD_APPROVAL`, `WAITING_COST_APPROVAL`, `WAITING_PRODUCTION_APPROVAL`, `READY_FOR_PRODUCTION` | Pending downstream approvals **EXPIRED**; run rewound to `WAITING_STORYBOARD_APPROVAL`; new PENDING + chat card |
| `PRODUCING`, `COMPLETED` | **Not** rewound; in-flight/completed MP4 and graph snapshot preserved for that run |
| Next run | Uses new storyboard revision after user re-approves |

## Production error handling (worker 6aaab0a)

`production.run` uncaught error → `agentRun.status=FAILED`, `productionState=FAILED`. Replaces prior stuck **PRODUCING** (regression r4 class E).
