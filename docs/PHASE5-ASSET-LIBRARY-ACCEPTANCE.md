# Phase 5J — Asset Library acceptance

**Status:** **NOT ACCEPTED** (full `phase5j-acceptance` in progress)  
**Git (E2E):** `b021fba` · **Web deployed:** `0d5d468d` (label `org.shotbro.build-sha=0d5d468d`) · **API:** label `HEAD` · **Worker:** `366716e`  
**Branch:** `phase5/creative-studio` · **VPS:** `85.117.235.93`

## 1. E2E runner — `b7b0703` (historical green)

| Field | Value |
|--------|--------|
| Log | `/var/log/shotbro-e2e/phase5-asset-library-b7b0703.log` |
| Active runner | **No** (no Playwright Docker container; stale `bash` wait loops ignore) |
| Exit | **0** |
| Result | **5 passed** (24.6s), retries=0 |
| Scope | DnD-only upload path; IDOR download-url only |

Superseded by **`b021fba`** (button + DnD steps, timeline API assert, expanded IDOR).

## 2. Current asset-library E2E — **`b021fba`**

| # | Test | Exit |
|---|------|------|
| 1 | desktop1920 full journey | **PASS** |
| 2 | desktop1440 smoke | **PASS** |
| 3 | tablet smoke | **PASS** |
| 4 | mobile390 smoke | **PASS** |
| 5 | IDOR (user B) | **PASS** |

**Log:** `/var/log/shotbro-e2e/phase5-asset-library-7d87159.log` · **5 passed (25.4s)**

### Root causes (earlier failures)

| Issue | RCA | Fix |
|--------|-----|-----|
| Wrong suite (`57f1579`) | Missing `phase5-asset-library` in Playwright script | `b076f47` |
| Card never visible | Upload never reached API (chooser/input) | DnD `DataTransfer` on `asset-library` |
| Storyboard | Locator matched `storyboard-scene-grid` | Click `button[data-testid^=storyboard-scene-]` inside grid |
| MP4 not READY | Synthetic MP4 invalid for FFmpeg | `public/demo-assets/shotbro-demo.mp4` |
| Button upload | Headless chooser/`setInputFiles` no React `onChange` | Web: label + native `change` listener; E2E: click «Загрузить» then DnD delivery |
| Timeline assert | Clips under `payload.tracks[]`; revision in `payload.revision` | `b021fba` |
| User journey | `project-assets` testid removed | Wrapper `data-testid="project-assets"` |

## 3. Upload evidence

- **DnD:** `POST /api/v1/uploads/init` → presigned PUT → `complete` → worker → **`READY`** (PNG + demo MP4).
- **Button:** Click `asset-upload` + DnD file delivery (headless-safe); production uses label + native file picker + `change` listener (`0d5d468d` web).
- **MP4 (ffprobe on VPS):** h264/yuv420p, 5s, 1080×1920, no audio — `shotbro-demo.mp4`.

## 4. Timeline / references / IDOR / lineage

- **Timeline:** PATCH on Save; API check `tracks[].clips[].assetId` + F5 reload (`b021fba`).
- **STYLE / first / last frame:** UI steps in desktop1920 journey.
- **IDOR:** User B denied list/detail/preview/download/rename/delete on user A asset (`INTEGRATION_USER_B_*`).
- **Lineage:** `generated_from` on mock provider ingest only; manual uploads **no** `asset_relation` (by design).

## 5. Full acceptance bundle

**Script:** `infra/scripts/staging-phase5j-acceptance.sh`  
**Resume:** `PHASE5J_START_AT=phase5-user-journey` (after green asset-library + prior regression pass)  
**Log:** `/var/log/shotbro-e2e/phase5j-acceptance-b021fba.log`

| Suite | Prior result (partial run) |
|--------|----------------------------|
| phase5-asset-library | PASS |
| regression-strict 8/8 | PASS |
| phase5-user-journey | FAIL → `project-assets` (fixed in web) |
| Remaining Phase 5 suites | Pending |

## 6. Ops

- **Disk:** ~31 GB free (~74% used). No aggressive prune.
- **Mock-only:** `AI_MOCK_MODE=true`, live paid providers OFF.
- **Deploy SHA:** `staging-deploy.sh` resolves `HEAD` → short SHA (`b076f47`); web redeploy **`0d5d468d`** for upload UX.

## 7. Formal acceptance

**Phase 5J = ACCEPTED** only when full acceptance log ends with `PHASE5J_ALL_PASS` and criteria 1–15 from phase brief are met.

**Phase 5K:** plan only — not started.
