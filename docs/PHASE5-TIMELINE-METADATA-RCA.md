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

- `infra/scripts/staging-phase5i-metadata-integration.sh` — metadata on run after approvals.
- `infra/scripts/staging-phase5i-assembly-proof.sh` — A→C→B colors + ~7.5s duration.
