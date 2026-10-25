# Phase 5I — REAL UI reliability

## Source of truth

PostgreSQL persists agent runs, messages/blocks, approvals, and production documents. SSE (`useProjectEvents`) invalidates React Query caches; it is **not** the only delivery path.

## Failure taxonomy (Phase 3/4 flaky)

| Cat | Symptom | Evidence |
|-----|---------|----------|
| A | Data missing in DB | API lists empty while UI idle |
| B | DB ok, API empty/wrong | Direct SQL vs HTTP mismatch |
| C | API ok, UI stale | Messages API has `generation_plan` / `approval` blocks; thread empty until reload |
| D | UI ok, Playwright misses | Wrong viewport scroll; button off-screen; stale locator |
| E | Wrong project/thread | `real-thread` `data-conversation-id` ≠ run’s conversation |

Recent regression-strict failures matched **C + D**: assistant blocks existed in `/messages` after agent run, but the chat column had not refetched before Playwright searched for «Утвердить» or Brief text.

## Fixes (Phase 5I recovery)

1. **SSE reconnect** — on `EventSource` `open`, invalidate `messages`, `approvals`, `agent-runs`.
2. **Project switch** — when `conversationId` resolves/changes, invalidate messages + approvals for that project.
3. **E2E** — `real-ui-sync.ts`: wait for blocks in messages API, then `resyncRealThreadFromApi` (navigation reload), then strict UI assertions (`generation-plan-card`, `approval-card`).
4. **Playwright** — `approvePendingApprovals` waits for PENDING in API, scrolls `real-thread`, clicks inside `data-testid="approval-card"`.

## Do not

- Drop Brief or approval UI checks in favor of API-only passes.
- Disable approvals or shrink phase3/4 scope.
- Rely on unbounded polling instead of reload after API readiness.

## Verification

Sequential on VPS: one phase3 desktop1440, one phase4 tablet, then `regression-strict` with `retries=0`. Save trace + `projectId` / `runId` on failure.
