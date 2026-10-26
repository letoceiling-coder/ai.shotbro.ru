# Phase 5I — Timeline acceptance

**Branch:** `phase5/creative-studio`  
**Git HEAD (2026-10-26 UTC):** `526b0ff` (regression: API approvals + agent-waits strict-mode fixes)

## Runtime (VPS staging)

| Service | `org.shotbro.build-sha` | Role |
|---------|-------------------------|------|
| API | `033aeae` | Timeline API, scene-id guards, orchestrator |
| Worker | `af5315f` | Timeline v2 assembly, mock RGB + audio mux |
| Web | `c2e9420` | Timeline studio UI |

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

**2026-10-26:** **14/14 PASS** on worker `af5315f`.

## Playwright

Log: `/var/log/shotbro-e2e/phase5i-acceptance.log`  
Runner: `infra/scripts/staging-phase5i-acceptance-e2e.sh` (`PHASE5I_E2E_START_FROM` to resume).

| Suite | Result (2026-10-26) |
|-------|---------------------|
| `phase5-timeline` (desktop, desktop1440, tablet, mobile) | **4/4 PASS** |
| `phase5-assembly` | **PASS** (13.6 s) |
| `regression-strict` | **NOT PASS** — resume + full run failed 8/8; root cause `WAITING_PRODUCTION_APPROVAL` + UI strict locator; fix `526b0ff` — **re-run in progress** `/var/log/shotbro-e2e/phase5i-regression-r3.log` |
| Remaining phase5 suites | Blocked on regression 8/8 |
| F5 / MP4 browser | **Not signed off** (pending green full acceptance) |

## Phase 5I close criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Worker ≥ `44e0a31` content deployed | **YES** (`af5315f`) |
| 2 | FFmpeg matrix 14/14 | **YES** |
| 3 | Timeline E2E 4 viewports | **YES** |
| 4 | Assembly E2E | **YES** |
| 5 | Phase 3/4 regression-strict 8/8 | **PENDING** |
| 6 | Other Phase 5 suites | **PENDING** |
| 7–11 | Music/voice/trim, persistence, mock-only | **YES** (matrix + assembly) |

**Phase 5I = NOT ACCEPTED** until `ALL_PASS` from acceptance runner (no Phase 5J).
