# Phase 5I — FFmpeg assembly

**Worker SHA (staging):** `82d72d4`  
**Entry:** BullMQ `production.run` → `assembleFromTimeline`.

## Inputs (timeline v2)

- Ordered **VIDEO** clips (`order`, `durationMs`, `sourceInMs`, `sceneId`, optional `assetId`).
- Mock mode (`AI_MOCK_MODE=true`): lavfi **RGB segments** by script scene index (history-aware if mock agent clobbered ACTIVE script).
- Non-mock: trim via `-ss sourceInMs` + `-t durationMs`; scene video from graph nodes when no clip asset.
- **VOICEOVER:** first clip mixed with `amix` when asset present.
- **MUSIC:** not mixed in worker (matrix case 8 = NOT IMPLEMENTED).

## Legacy fallback

Timeline v2 present but snapshot missing → **`TimelineAssemblyError`** (no silent 3 s MP4).  
True legacy runs without v2 → previous lavfi path.

## Verification

| Tool | Purpose |
|------|---------|
| `staging-phase5i-assembly-proof.sh` | A→C→B order, ~7.5 s, RGB frames |
| `staging-phase5i-ffmpeg-matrix.sh` | Matrix JSON on VPS |
| `ffprobe` | Duration / codec on worker container |

## Matrix snapshot (2026-10-26)

**PASS:** 1-scene sync (after `38892c7`), 3-scene assembly, reorder, durations, 5-scene sync, revision idempotency, new version.  
**NOT IMPLEMENTED:** trim ffprobe harness, voiceover fixture, music, missing/invalid clip, duplicate submit, F5 persistence (use `phase5-assembly` E2E when green).
