# Phase 5 — Progress

**Branch:** `phase5/creative-studio`  
**Git HEAD (VPS, 2026-10-27):** `3eb89d3`  
**Phase 5I:** **ACCEPTED**  
**P0 UI Recovery:** **ACCEPTED**

## Deployed staging (https://ai.shotbro.ru)

| Service | `org.shotbro.build-sha` | Notes |
|---------|-------------------------|--------|
| API | **6aaab0a** | Storyboard revision → approval integrity, timeline ensure |
| Worker | **6aaab0a** | `production.run` → **FAILED** on assembly error (no infinite PRODUCING) |
| Web | **3eb89d3** | Approval card hydrates **EXPIRED** from API; Creative + Production UI · deploy log `deploy-web-3eb89d3.log` |

**Mock policy:** `AI_MOCK_MODE=true`, live providers off — **0 paid AI calls**.

**VPS disk (2026-10-27):** `/dev/vda1` **~74%** used, **~31 GB** free.

## Phase 5I sign-off evidence (`retries=0`)

| Suite | Result | Exit | Log |
|-------|--------|------|-----|
| FFmpeg matrix | **14/14 PASS** | 0 | `/tmp/phase5i-ffmpeg-matrix.json` (prior run) |
| Scene ID integration | **PASS** | 0 | `staging-phase5i-scene-id-integration.sh` |
| Timeline assembly A→C→B | **PASS** | 0 | harness / r10 artifact |
| `regression-strict` | **8/8 PASS** | 0 | `regression-strict-6aaab0a.log` |
| `phase5-user-journey` | **4/4 PASS** | 0 | `phase5-user-journey-b68527c.log` |
| `phase5-storyboard` | **5/5 PASS** | 0 | `phase5-storyboard-6aaab0a.log` |
| `phase5-characters` | **PASS** | 0 | `phase5i-signoff-suites.log` |
| `phase5-references` | **PASS** | 0 | same |
| `phase5-creative-flow` | **PASS** | 0 | same |
| `phase5-prompts` | **PASS** | 0 | same |
| `phase5-providers` | **PASS** | 0 | same |
| `phase5-timeline` | **PASS** | 0 | same |
| `phase5-assembly` | **1/1 PASS** | 0 | same |

Runner: `infra/scripts/staging-phase5-signoff-suites.sh` · consolidated log **`phase5i-signoff-suites.log`** ends with **`ALL_PASS`**.

## User journey coverage

- **Desktop1920:** full REAL path — UI approvals, Storyboard Sync + scene edit + re-approve, references, timeline reorder, mock MP4, F5 (`phase5-user-journey-b68527c.log`).
- **1440 / tablet / mobile390:** REAL nav smoke only (not four full production runs).

## Key product fixes (5I closure)

- Storyboard document revision → expire stale PENDING approvals, rewind gate, new chat card — see `PHASE5-APPROVAL-REVISION-INTEGRITY.md`.
- Web approval cards sync status from `/approvals` (**EXPIRED** badge, disabled actions, hint text).
- E2E approves **latest** pending card (`.last()`).

## Stage status

| Stage | Status |
|-------|--------|
| 5A–5G, 5MP | **ACCEPTED** (prior docs) |
| **5I** Timeline + FFmpeg + mock production | **ACCEPTED** |
| P0 UI Recovery (REAL vs DEMO, journey) | **ACCEPTED** |
| **5J** Asset Library | **NOT STARTED** — plan only below |

## Visual acceptance (2026-10-27)

Browser smoke (2026-10-27): https://ai.shotbro.ru/studio — DEMO banner, chat blocks, REAL entry CTA. Full REAL path (Chat → Storyboard → Timeline → Production → Assets, approvals, MP4, F5): **`phase5-user-journey-b68527c.log`**. Manual REAL browser requires login; EXPIRED hydration verified after web **3eb89d3** deploy.

Screenshot: [`phase5i-visual/studio-demo-chat-2026-10-27.png`](phase5i-visual/studio-demo-chat-2026-10-27.png)

## Remaining blockers

**None** for Phase 5I / P0 UI Recovery sign-off.

Optional follow-up (non-blocking): persist **EXPIRED** on historical message blocks in DB (today: live API hydration on render).

---

## Phase 5J — Asset Library (plan only, do not implement without new task)

1. **Scope:** Unified asset browser (filters, lineage to scenes/runs, signed playback) atop existing MinIO + `project-assets` API.
2. **Dependencies:** Stable production delivery assets (5I done), reference attach model (5F).
3. **Acceptance:** Playwright asset discovery + download; no new paid providers.
4. **Out of scope for 5J draft:** New orchestrator states, live generation, billing changes.
