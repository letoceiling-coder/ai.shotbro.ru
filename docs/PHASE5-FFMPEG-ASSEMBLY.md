# Phase 5I — FFmpeg assembly

**Entry:** worker `production-run.ts` node `ASSEMBLY`.

## Inputs (timeline v2)

- Ordered **VIDEO** clips (`order`, `durationMs`, `sourceInMs`, optional `assetId`).
- Resolve media: clip `assetId` or scene `VIDEO_GENERATION` node output.
- Missing asset: colored lavfi segment (distinct hex per index) for mock order verification.
- Optional **VOICEOVER** first clip mixed with `-filter_complex amix`.

## Outputs

- Unique MinIO key `mock/final-{uuid}.mp4` (no overwrite).
- `production_document` DELIVERY payload includes `timelineVersion`, `timelineHash`, `clipCount` when applicable.

## Legacy fallback

If no parseable v2 timeline → previous `assembleMp4` lavfi concat (Phase 3/4 behavior).

## Verification

Use `ffprobe` on VPS for duration/codec; E2E checks asset list + UI persistence.
