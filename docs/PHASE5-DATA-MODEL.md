# Phase 5 — Data model notes

## Script scene (extended contract)

`ScriptScenePayloadSchema` (v1) adds optional production fields: `action`, `dialogue`, `voiceover`, `camera`, `lighting`, `location`, `characters[]`, `visualStyle`, `transition`, `status`, `revision`. Existing stored scripts parse with Zod defaults (`revision: 1`, `status: draft`).

Script document metadata fields: `concept`, `format`, `style`, `targetAudience`, `toneOfVoice`, `synopsis` (optional).

## Versioning rules

- Each script edit supersedes prior `production_document` row (`ACTIVE` → `SUPERSEDED`, new row with `parentDocumentId`).  
- Scene PATCH requires optional `expectedRevision`; mismatch → HTTP 409.  
- Total duration recomputed from scene `durationSeconds` sum.

## API additions (Phase 5C)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/projects/:id/script` | Active SCRIPT document |
| PATCH | `/api/v1/projects/:id/script` | Metadata patch |
| POST | `/api/v1/projects/:id/scripts/scenes` | Add scene |
| PATCH | `/api/v1/projects/:id/scripts/scenes/:sceneId` | Update scene |
| POST | `/api/v1/projects/:id/scripts/scenes/:sceneId/delete` | Delete scene |
| POST | `/api/v1/projects/:id/scripts/scenes/:sceneId/duplicate` | Duplicate |
| POST | `/api/v1/projects/:id/scripts/scenes/reorder` | Reorder |

## Not yet modeled in UI

- Storyboard frame → asset refs for first/last frame (5D).  
- Reference roles (`first_frame`, `style`, …) — 5F.  
- Timeline JSON schema validation — 5I.  
- Per-scene model selection document — 5H.

## Character record (existing)

```ts
CharacterRecord {
  id, name, appearance?, wardrobe?, voiceNotes?,
  referenceAssetIds?, sceneIds?, version
}
```

Stored in project memory JSON until normalized (future migration if needed).
