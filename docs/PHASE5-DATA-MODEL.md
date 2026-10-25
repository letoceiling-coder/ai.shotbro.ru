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

## Prompt version (5G)

Table `prompt_version` stores one row per save. Structured fields live in JSON:

- `parameters.scenePromptBundle` — `ScenePromptBundle` (`packages/contracts/src/production/prompt-schemas.ts`): image + video structs, `imageModelId`, `videoModelId`, optional `modelParameters`, optional `restoredFromVersion`.  
- `parameters.settingsSnapshot` — copy of `project_memory.preferences.sceneModelSettings[sceneId]` at save time.  
- `parameters.changeNote` — optional author note (including `restore:vN`).  
- `renderedPrompt` — denormalized primary image prompt text (legacy consumers).  
- `createdBy` — user id; versions are append-only (no hard delete).

API (project-scoped):

| Method | Path |
|--------|------|
| GET | `/scenes/:sceneId/prompts` |
| GET | `/scenes/:sceneId/prompts/latest` |
| GET | `/scenes/:sceneId/prompts/versions/:version` |
| GET | `/scenes/:sceneId/prompts/compare?a=&b=` |
| POST | `/scenes/:sceneId/prompts` (`{ bundle, changeNote? }` or legacy `{ renderedPrompt }`) |
| POST | `/scenes/:sceneId/prompts/restore` |
| POST | `/scenes/:sceneId/prompts/validate` |

Graph invalidation runs on each new version (same as storyboard scene edits).

## Not yet modeled in UI

- Timeline JSON schema validation — 5I.  
- Unified Production tab graph (5H+).  
- Prompt-linked asset thumbnails (preview notes only in 5G).

## Character record (existing)

```ts
CharacterRecord {
  id, name, appearance?, wardrobe?, voiceNotes?,
  referenceAssetIds?, sceneIds?, version
}
```

Stored in project memory JSON until normalized (future migration if needed).
