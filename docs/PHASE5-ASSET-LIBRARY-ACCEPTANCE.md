# Phase 5J — Asset Library acceptance

**Status:** IN PROGRESS (pending VPS Playwright + regression)  
**Branch:** `phase5/creative-studio`

## Scope delivered (code)

- Extended `AssetsService` — paginated library list, detail, preview-url, rename, guarded delete.
- `asset-enrichment.ts` — role tags from storyboard / timeline / references / graph (no duplicate storage).
- REAL UI `AssetLibraryView` — grid/list, search, filters, multi-upload, DnD, detail sheet, preview via thumb/poster.
- Integrations: first/last frame, references, download, timeline navigation; picker uses preview-url.
- E2E: `phase5-asset-library.spec.ts` (4 viewports + IDOR with user B env).
- Runner: `infra/scripts/staging-phase5j-acceptance.sh`.

## VPS verification (fill after run)

| Check | Result | Log |
|-------|--------|-----|
| Git HEAD | | |
| API SHA | | |
| Web SHA | | |
| `phase5-asset-library` | | `phase5j-acceptance.log` |
| Regression bundle | | same |

## Done criteria mapping

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Library in Creative Workspace | `creative-section-assets` → `asset-library` |
| 2 | MinIO/API source | upload + list + signed URLs |
| 3–5 | Filters, preview, download | UI + API |
| 6 | Upload | `useRealUpload` + worker processing |
| 7 | Scene / reference bind | detail actions + storyboard E2E step |
| 8 | MP4 / final filter | `final` role + production assets |
| 9 | Lineage | `asset_relation` + «Источник неизвестен» |
| 10 | Isolation | IDOR test / AccessPolicy |
| 11 | F5 | E2E reload step |
| 12–13 | Playwright + regression | staging script |
| 14 | Mock-only | unchanged env |

## Remaining / known limits

- Lineage edges populated only when `asset_relation` rows exist (ingestion hooks incremental).
- «Add to timeline» opens Timeline tab; clip assign still in Timeline UI (existing PATCH).
- Chat attach from library: use existing composer attach (not duplicated in 5J).
