# Phase 5F — Reference Manager

**Status:** **ACCEPTED** (staging, 2026-10-25)  
**Web SHA under test:** `015cbb7`  
**E2E repo SHA:** `68a09d7`  
**Log:** `/var/log/shotbro-e2e/phase5-references-015cbb7.log`  
**Runner:** `phase5-references` · `retries=0`

## Gate matrix

| Gate | Status |
|------|--------|
| IMPLEMENTED | `ReferenceService` + Reference Manager UI + asset picker |
| PERSISTED | `projectMemory.preferences.referenceLinks` |
| WIRED | attach/detach REST, roles on scene/character |
| VISIBLE | References tab, picker dialog |
| TESTED | `apps/web/e2e/phase5-references.spec.ts` |
| DEPLOYED | VPS staging |

## E2E coverage

| Viewport | Result |
|----------|--------|
| desktop1920 | **PASS** |
| desktop1440 | **PASS** |
| tablet | **PASS** |
| mobile390 | **PASS** |

**Additional:** cross-project isolation — asset attached in project A not visible in project B (**PASS**). Second project seeded via API (not duplicate UI create).

Flow: upload asset → picker → attach to scene/character → FIRST_FRAME / LAST_FRAME / STYLE roles → save → **F5** → detach → object remains in storage when still referenced elsewhere (detach does not delete shared MinIO object).

## Security

- Project-scoped assets and reference links via access policy.
- Signed URLs for browser fetch; no storage secrets in client bundle.
- Magnific credentials server-only in `staging.env` — **ROTATION_REQUIRED** if previously exposed in chat; never logged in E2E output.

## Blockers

None for 5F closure.
