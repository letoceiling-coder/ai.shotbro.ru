# Phase 5D — Storyboard Studio acceptance

**Status:** **ACCEPTED** (staging, 2026-10-25)  
**Web SHA under test:** `015cbb7`  
**E2E repo SHA:** `68a09d7`  
**Log:** `/var/log/shotbro-e2e/phase5-storyboard-015cbb7.log`  
**Runner:** `bash infra/scripts/staging-playwright-e2e.sh <repo> phase5-storyboard` · `retries=0`

## Gate matrix

| Gate | Status |
|------|--------|
| IMPLEMENTED | `StoryboardDocumentService` + REST + `storyboard-studio.tsx` |
| PERSISTED | `production_document` STORYBOARD v2, scene fields + revision |
| WIRED | Script sync, reorder, duration/title/description, first/last frame refs |
| VISIBLE | `data-testid` hooks on grid/list/detail |
| TESTED | `apps/web/e2e/phase5-storyboard.spec.ts` |
| DEPLOYED | VPS staging web `015cbb7` |

## E2E coverage (REAL login, UI + API persistence)

| Viewport | Result |
|----------|--------|
| desktop1920 (1920×…) | **PASS** |
| desktop1440 | **PASS** |
| tablet | **PASS** |
| mobile390 | **PASS** |

**Additional:** revision conflict → **409 PASS** (stale revision PATCH).

Flow exercised per viewport: create project → script scene → open Storyboard → sync → edit description/duration → reorder → assign first/last frame → save → reload → assert API-backed fields (not frontend-only state).

**Evidence:** `test-results/phase5-storyboard-grid-{viewport}.png`, `phase5-storyboard-detail-{viewport}.png`.

## Fixes during acceptance (no feature rewrite)

- Controlled title/description with **blur-save** to avoid revision races.
- E2E waits on PATCH / polls `firstFrameAssetId` / `lastFrameAssetId`.
- Script bootstrap via helper when new project has empty script doc.

## Policy

Mock-only staging; no live generation in this suite.

## Blockers

None for 5D closure.
