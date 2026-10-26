# Phase 5I — Timeline acceptance

**Branch:** `phase5/creative-studio`  
**Git HEAD (2026-10-26):** `38892c7` (scene-id guards `033aeae`, assembly proof r10, matrix script)

## Runtime (VPS staging)

| Service | `org.shotbro.build-sha` | Role |
|---------|-------------------------|------|
| API | `033aeae` | Timeline API, scene-id guards, orchestrator |
| Worker | `82d72d4` | Timeline v2 assembly, mock RGB segments |
| Web | *(unchanged this pass)* | Timeline studio UI |

**Policy:** mock-only AI; no live provider spend.

## Assembly proof r10 (frozen)

Artifact: `/tmp/phase5i-assembly-proof-r10.json`  
Verify: `infra/scripts/staging-phase5i-r10-verify.sh`

| Check | Result |
|-------|--------|
| Duration | **7.52 s** (ffprobe) |
| Colors | **RED → BLUE → GREEN** (sampled from MP4) |
| Legacy fallback | **None** for this run |
| DB run metadata | timeline fields present |

## Scene ID consistency

See `PHASE5-SCENE-ID-CONSISTENCY.md`.  
Integration: `staging-phase5i-scene-id-integration.sh` → **PASS** after `033aeae`.

## FFmpeg matrix (14)

Script: `staging-phase5i-ffmpeg-matrix.sh` → `/tmp/phase5i-ffmpeg-matrix.json`

Latest run: **6 PASS**, **1 FAIL** (single-scene clip count — fix in `38892c7`), **7 NOT IMPLEMENTED** (trim/voice/music/missing asset/idempotency submit/F5 E2E harness).

Formal **14/14 PASS** not claimed until NOT IMPLEMENTED cases have harnesses or explicit product deferral.

## Playwright

| Suite | Result (2026-10-26) |
|-------|---------------------|
| `phase5-timeline` (4 viewports) | **11 pass**, **2 fail** (duration assert; fix pending deploy `phase5-timeline.spec.ts`) |
| `phase5-assembly` | **FAIL** — `real-thread` not visible (composer bootstrap) |
| `regression-strict` | **NOT RUN** this pass |

## Phase 5I close criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1–4 | Timeline order, FFmpeg assembly, duration, metadata | **PASS** (r10 + matrix core) |
| 5 | Scene IDs Script/Storyboard/Timeline | **PASS** (guards + integration) |
| 6 | FFmpeg 14/14 | **OPEN** (7 NOT IMPLEMENTED) |
| 7 | Timeline E2E 4 viewports | **OPEN** |
| 8 | Assembly E2E | **OPEN** |
| 9 | Phase 3/4 strict 8/8 | **NOT RUN** |
| 10–12 | Regression suites | **NOT RUN** |

**Phase 5I:** acceptance **in progress** — do not start Phase 5J.
