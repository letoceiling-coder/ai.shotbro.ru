# Phase 5I — FFmpeg assembly

**Worker SHA (staging):** `af5315f` (`shotbro/worker:current` image `fd41ee9b3c0f`; includes timeline assembly through `44e0a31`)  
**Entry:** BullMQ `production.run` → `assembleFromTimeline`.

## Inputs (timeline v2)

- Ordered **VIDEO** clips (`order`, `durationMs`, `sourceInMs`, `sceneId`, optional `assetId`).
- Mock mode (`AI_MOCK_MODE=true`): lavfi **RGB segments** by script scene index (history-aware if mock agent clobbered ACTIVE script).
- Non-mock: trim via `-ss sourceInMs` + `-t durationMs`; scene video from graph nodes when no clip asset.
- **VOICEOVER:** first clip mixed with `amix` when asset present.
- **MUSIC:** mixed with voice/video when MUSIC track assets present (`TIMELINE_MOCK_USE_ASSETS` on staging harness).

## Legacy fallback

Timeline v2 present but snapshot missing → **`TimelineAssemblyError`** (no silent 3 s MP4).  
True legacy runs without v2 → previous lavfi path.

## Verification

| Tool | Purpose |
|------|---------|
| `staging-phase5i-assembly-proof.sh` | A→C→B order, ~7.5 s, RGB frames |
| `staging-phase5i-ffmpeg-matrix.sh` | Matrix JSON on VPS |
| `ffprobe` | Duration / codec on worker container |

## Matrix snapshot (2026-10-26, VPS)

Script: `bash infra/scripts/staging-phase5i-ffmpeg-matrix.sh /tmp/phase5i-ffmpeg-matrix.json`  
Result: **14 PASS / 0 FAIL** (exit 0). Evidence: `/tmp/phase5i-ffmpeg-matrix.json`, harness stdout `/tmp/phase5i-matrix-harness.out`.

| Id | Case | Notes |
|----|------|--------|
| 1–5 | clip counts + assembly proof | A→C→B, 7.52 s, RGB |
| 6–10 | worker harness | trim, voice, music, missing, invalid |
| 11 | duplicate submit | `duplicateSubmitOk` in assembly proof |
| 12–13 | timeline API smoke | revision / reorder |
| 14 | mp4 persistence | `asset.status=READY` via psql |

**Docker build:** `Dockerfile.worker` — `apk`/FFmpeg before `LABEL org.shotbro.build-sha` so SHA bumps do not reinstall 294 packages. Deploy lock: `/var/lock/shotbro-docker.lock` (`staging-phase5i-docker-lock-smoke.sh` PASS).
