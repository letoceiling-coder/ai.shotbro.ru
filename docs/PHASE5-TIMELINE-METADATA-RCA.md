# Phase 5I — Timeline metadata RCA

## Failed proof run (r4)

| Field | Value |
|-------|--------|
| runId | `4117fa87-4ba6-49f0-9faf-5c8f79fd1e0d` |
| projectId | `67e3fee1-4bcc-42b4-869d-6ef657248d63` |
| Symptom | Worker `runMeta: {}`, `timeline_assembly_fallback_legacy`, MP4 **3.0s** |

## First broken hop

**ProductionOrchestrator → `saveDocument(TIMELINE)`** at `WAITING_PRODUCTION_APPROVAL`.

The mock orchestrator wrote a **legacy board payload** (`schemaVersion: 1`, no tracks) via `DrizzleProductionStorage.saveDocument`, which **superseded** the user’s **Timeline v2** (`schemaVersion: 2`) document.

## Evidence chain

| Stage | Expected | Observed (r4) |
|-------|----------|----------------|
| Timeline v2 in PostgreSQL | ACTIVE v2, version 6 | Present before production gate |
| After production approval gate | v2 still addressable | **ACTIVE replaced by legacy v1 row** |
| `loadTimelineSnapshot` | `timelineVersion`, hash | **`{}`** (ACTIVE row not schema v2) |
| `agent_run.metadata` | snapshot fields | **Empty** at worker assembly |
| BullMQ `production.run` job | snapshot in job data | **Missing** (same `{}` spread) |
| Worker | `assembleFromTimeline` | **Legacy 3s lavfi** |

Classification: **A** (fields absent in PostgreSQL effective view) caused by orchestrator overwrite, not worker parse alone.

## Fix (minimal)

1. **Remove** legacy TIMELINE write from `production-orchestrator` production gate.
2. **Guard** `saveDocument(TIMELINE)` — never supersede ACTIVE schema v2 with non-v2 payload.
3. **`loadTimelineSnapshot` / worker load** — resolve **latest `schema_version = 2`** by version (includes SUPERSEDED montage rows).
4. **`TimelineAssemblyContext`** — typed merge of job payload + run metadata.
5. **Worker** — if project has timeline v2 but snapshot cannot load → **`TIMELINE_SNAPSHOT_*` error**, no silent legacy MP4.

## Verification

| Check | Result | Notes |
|-------|--------|--------|
| `staging-phase5i-metadata-integration.sh` | **PASS** (post `5ecba66`) | `metadataKeys` includes `timelineDocumentId`, `timelineVersion`, `timelineHash` |
| Assembly duration ~7.5s | **PASS** (r5–r8) | `timeline_assembly_start` with full `runMeta`; no `timeline_assembly_fallback_legacy` |
| A→C→B frame colors | **In progress** (r9 pending) | Mock agent overwrote ACTIVE script to `scene-1..3` while timeline kept UUID `sceneId`s → worker now resolves **script revision history**; proof script drops bootstrap `Scene 1` |
| Runtime (2026-10-26) | API `5ecba66`, Worker target `82d72d4` | Deploy via `staging-deploy.sh --service worker 82d72d4` |

### Secondary issue (mock colors)

After metadata fix, assembly proof failed on **RGB order** while duration was correct. DB showed ACTIVE **mock storyboard v1 `frames`** (`scene-1..3`) and ACTIVE **mock script** after agent run, but **timeline v6 clips** still referenced **UUID** scene ids from pre-agent sync. Fix: `mockSceneColorIndex()` scans script (and storyboard) **document versions**; assembly proof removes extra bootstrap scene before sync.
