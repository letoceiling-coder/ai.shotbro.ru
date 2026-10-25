# Phase 5I — Timeline data model

Store: `production_document` where `docType = TIMELINE`, `schemaVersion = 2`.

Payload: `TimelineDocumentSchema` — `fps`, `resolution`, `totalDurationMs`, `revision`, `tracks[]`.

Tracks: `VIDEO`, `VOICEOVER`, `MUSIC`, `SFX`.

Clip fields: `clipId`, `sceneId`, `assetId`, `trackId`, `startTimeMs`, `sourceInMs`, `sourceOutMs`, `durationMs`, `order`, `volume`, `muted`, `status`.

Versioning: each edit supersedes prior row (`ACTIVE` → `SUPERSEDED`), `revision` incremented, HTTP **409** on `expectedRevision` mismatch.

Assembly snapshot on run: `timelineDocumentId`, `timelineVersion`, `timelineHash` in agent run metadata at enqueue time.
