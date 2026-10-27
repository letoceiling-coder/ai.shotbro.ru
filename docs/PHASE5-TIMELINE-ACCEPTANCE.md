# Phase 5I — Timeline acceptance

**Status:** **ACCEPTED** (2026-10-27)  
**Branch:** `phase5/creative-studio` · **Git HEAD:** `a2395a9`

## Runtime (VPS staging)

| Service | `org.shotbro.build-sha` |
|---------|-------------------------|
| API | **6aaab0a** |
| Worker | **6aaab0a** |
| Web | **a2395a9** |

**Policy:** mock-only AI; no live provider spend.

## FFmpeg matrix

**14/14 PASS** on worker `af5315f`/`6aaab0a` lineage — artifact `/tmp/phase5i-ffmpeg-matrix.json` (see prior acceptance run).

## Assembly proof

Frozen r10 artifact + color order RED→BLUE→GREEN — `PHASE5-FFMPEG-ASSEMBLY.md`, `/tmp/phase5i-assembly-proof-r10.json`.

## Scene ID consistency

Integration script **PASS** — `PHASE5-SCENE-ID-CONSISTENCY.md`.

## Playwright (`retries=0`)

| Mode | Result | Log |
|------|--------|-----|
| `phase5-timeline` | **PASS** (4 viewports in spec) | `phase5i-signoff-suites.log` |
| `phase5-assembly` | **1/1 PASS** | same |
| P0 user journey (timeline sync/reorder UI) | **PASS** | `phase5-user-journey-b68527c.log` |

## Production error handling

Worker `production.run` job: on assembly failure → graph node **FAILED**, agent run **`productionState=FAILED`** (no infinite **PRODUCING**). UI Production section reflects backend state (journey + phase3/4 strict).

## F5 / MP4 persistence

Verified in user journey: mock delivery asset **READY**, timeline revision ≥ 1 after reload — log `phase5-user-journey-b68527c.log`.
