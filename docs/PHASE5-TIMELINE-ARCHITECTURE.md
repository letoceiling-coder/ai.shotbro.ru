# Phase 5I — Timeline architecture

**Scope:** Versioned `TIMELINE` documents in `production_document`, Creative **Timeline** tab, worker FFmpeg concat driven by saved clip order/duration.

## Flow

1. User syncs Storyboard → `TimelineDocumentService.syncFromStoryboard` builds **VIDEO** track clips (`schemaVersion: 2`).
2. User reorders/trims in UI → `PATCH /timeline` or `POST /timeline/reorder` creates new document version + invalidates **ASSEMBLY** graph nodes.
3. Production enqueue → `ProductionGraphService.startProductionRun` snapshots `timelineVersion` + `timelineHash` on `agent_run.metadata`.
4. Worker **ASSEMBLY** → `loadTimelineForAssembly` + `assembleFromTimeline` (concat + optional voiceover). Legacy path if no v2 timeline.

## Components

| Layer | Module |
|-------|--------|
| Contracts | `packages/contracts/src/production/timeline-schemas.ts` |
| API | `TimelineDocumentService`, routes under `/api/v1/projects/:id/timeline/*` |
| UI | `apps/web/src/components/creative/sections/timeline-studio.tsx` |
| Worker | `apps/worker/src/timeline-assembly.ts` |

Mock-only; no provider calls from Timeline.
