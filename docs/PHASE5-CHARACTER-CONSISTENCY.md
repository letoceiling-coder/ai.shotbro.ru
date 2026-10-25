# Phase 5E — Character Studio & consistency

**Status:** **ACCEPTED** (staging, 2026-10-25)  
**Web SHA under test:** `015cbb7`  
**E2E repo SHA:** `68a09d7`  
**Log:** `/var/log/shotbro-e2e/phase5-characters-015cbb7.log`  
**Runner:** `phase5-characters` · `retries=0`

## Gate matrix

| Gate | Status |
|------|--------|
| IMPLEMENTED | `CharacterContinuityService` + Character Studio UI |
| PERSISTED | `projectMemory.characters` + version history |
| WIRED | assign-scene, profile edit, restore version |
| VISIBLE | Gallery + editor in Creative Workspace |
| TESTED | `apps/web/e2e/phase5-characters.spec.ts` |
| DEPLOYED | VPS staging |

## E2E coverage

| Viewport | Result |
|----------|--------|
| desktop1920 | **PASS** |
| desktop1440 | **PASS** |
| tablet | **PASS** |
| mobile390 | **PASS** |

Flow: create character → edit name/appearance → upload reference → set primary image → assign to scene → change profile → new version → restore version → **F5** → scene remains pinned to the intended profile version.

**Consistency intent:** scene assignment records profile version; in-flight runs are not retroactively rewritten by character edits (graph invalidation / production rules as implemented in API).

## Policy

Mock fixtures only; no live face-match or paid provider calls.

## Blockers

None for 5E closure.
