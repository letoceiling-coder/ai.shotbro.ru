# Phase 5J — Asset Library architecture

**Branch:** `phase5/creative-studio`  
**Baseline (staging):** API/worker **6aaab0a**, web **3eb89d3**  
**Status:** IN PROGRESS

## Audit — existing vs gaps

| Capability | API / storage | UI | Gap for 5J |
|------------|---------------|-----|------------|
| Project-scoped asset rows | `asset` table, MinIO keys under `workspaces/.../assets/{id}/original/` | — | OK |
| Upload (single + multipart) | `UploadsService` + presigned PUT, MIME sniff, quarantine | `useRealUpload`, single file in Assets | Multi-file, DnD, progress UX |
| Post-upload processing | Worker `processAssetMetadata` — sharp thumb, ffmpeg poster/probe | — | Expose **preview-url** (thumb/poster), not full MP4 in grid |
| List assets | `GET /projects/:id/assets` — limit 100, no category in JSON | Basic grid in `ProjectAssetsSection` | Pagination, search, sort, filters, list/grid |
| Signed download | `GET /assets/:id/download-url` + `AccessPolicyService` | Used for previews (loads full file) | Separate preview endpoint; download action |
| Soft delete / restore | `POST /assets/:id/delete|restore` | None | Safe delete + dependency check in UI |
| Versions | `asset_version` + `GET /assets/:id/versions` | None | Version panel in detail drawer |
| Lineage graph | `asset_relation` table **defined, unused** | None | Populate on ingestion; read in detail API |
| Categories | `asset.category` (`upload`, `provider_mock`, …) | Not returned in list DTO | Multi-role tags derived from storyboard/refs/timeline/graph |
| References attach | `ReferenceService` + project memory | `ReferenceManager`, `AssetPickerDialog` | “Add to references” from library |
| Storyboard frames | PATCH scene `firstFrameAssetId` / `lastFrameAssetId` | `StoryboardStudio` + picker | “Use in scene” from library |
| Timeline clip media | PATCH timeline clip `assetId` | `TimelineStudio` select | “Add to timeline” from library |
| Generated / delivery | Worker `production-run`, graph `outputAssetIds`, mock MP4 | `ProductionSection` heuristic find MP4 | Filter **final** / **generation**; open MP4 from library |
| Provider mock ingest | `ProductionAssetIngestionService` | — | Tag + lineage metadata on ingest |
| Project isolation | `AccessPolicyService.assertProjectAccess` on all asset routes | — | E2E cross-project negative |
| Thumbnails | S3 `/thumb/`, `/poster/` keys | Not used | Preview URLs only |

**Reuse (no duplicate storage):** `AssetsService`, `UploadsService`, `asset` / `asset_version` / `asset_relation`, MinIO layout, worker `process-asset`, existing creative PATCH/reference APIs.

**New (5J):** `AssetLibraryService` (enrichment + lineage + delete guard), extended list query params, preview-url endpoint, asset detail endpoint, REAL library UI (`AssetLibraryView`), Playwright `phase5-asset-library.spec.ts`.

## API surface (5J)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/projects/:projectId/assets` | Legacy array **or** `{ items, nextCursor }` when `limit` / `cursor` / filters present |
| GET | `/api/v1/assets/:assetId` | Detail + roles + scene links + lineage |
| GET | `/api/v1/assets/:assetId/preview-url` | Thumb/poster signed URL |
| GET | `/api/v1/assets/:assetId/download-url` | Existing full object |
| PATCH | `/api/v1/assets/:assetId` | Rename (`originalName`) |
| POST | `/api/v1/assets/:assetId/delete` | Soft delete after dependency check |

## Category / role filters (logical)

Filters map to metadata, not separate buckets:

- **upload** — `category=upload`
- **reference** — linked in `referenceLinks`
- **first_frame** / **last_frame** — storyboard scene fields
- **generation** — graph node outputs / `provider_mock`
- **final** — delivery MP4 (`mock-delivery` name or graph FINAL node)
- **image** / **video** / **audio** — MIME prefix

An asset may appear under multiple filters.

## Lineage

Edges stored in `asset_relation` (`relationType`: `generated_from`, `enhanced_from`, `timeline_output`, `delivery_from`).  
UI graph built from DB; missing edges → «Источник неизвестен».

## Security (unchanged principles)

Session guard, project access on every asset id, presigned TTL, sanitized filenames, no public bucket reads, IDOR covered by integration tests + 5J E2E.

## Out of scope (5J)

- ProductionOrchestrator / approval / budget changes  
- Paid AI thumbnails  
- Phase 5K
