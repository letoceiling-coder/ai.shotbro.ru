# Phase 5J — Asset Library acceptance

**Status:** **ACCEPTED**  
**Git (VPS E2E checkout):** `172a4df` (`fix(e2e): picker via input FileList injection; DnD-only desktop bulk`)  
**Branch:** `phase5/creative-studio` · **VPS:** `85.117.235.93`

## Runtime (staging, 2026-10-28)

| Service | Container | Image ID (short) | `org.shotbro.build-sha` | Notes |
|---------|-----------|------------------|-------------------------|--------|
| Web | `infra-web-1` | `0dded400e62d` | **`3374efcb`** | Upload label + file input UX |
| API | `ai-shotbro-staging-api-1` | `a785a2d199c9` | **`HEAD`** (label) | Last API tree commit at deploy: **`57f1579`** |
| Worker | `ai-shotbro-staging-worker-1` | `cd6f6eb142cf` | **`366716e`** | Upload finalize / READY |

- **Health:** `GET /api/v1/health/live` → `{"status":"ok"}`, `/ready` → `{"status":"ready"}`  
- **Disk:** `/dev/vda1` ~**31 GB** free (~74% used)  
- **Mock-only:** `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false` (verified in API container). No paid OpenRouter / Fal / Magnific / ElevenLabs live execution.

**Deploy note:** API image label remains literal `HEAD`; next deploy must pin SHA via `staging-deploy.sh` (`shotbro_resolve_deploy_sha`). No rebuild performed for label-only fix.

## Full Phase 5J acceptance bundle

**Script:** `infra/scripts/staging-phase5j-acceptance.sh`  
**Log:** `/var/log/shotbro-e2e/phase5j-acceptance-172a4df.log`  
**Resume:** not used (full run from `phase5-asset-library`)  
**Terminal marker:** **`PHASE5J_ALL_PASS`** · **exit 0** · retries=0 · sequential suites only

| Suite | Result | Exit |
|--------|--------|------|
| phase5-asset-library | **PASS** (6 tests) | 0 |
| regression-strict | **PASS** (8/8) | 0 |
| phase5-user-journey | **PASS** (4/4) | 0 |
| phase5-storyboard | **PASS** | 0 |
| phase5-characters | **PASS** | 0 |
| phase5-references | **PASS** | 0 |
| phase5-creative-flow | **PASS** | 0 |
| phase5-timeline | **PASS** | 0 |
| phase5-assembly | **PASS** | 0 |
| phase5-prompts | **PASS** | 0 |
| phase5-providers | **PASS** | 0 |

Prior partial run (`phase5j-acceptance-b021fba.log`) failed on **phase5-references** (asset picker timeout); fixed in **`a8b67ec`** (READY poll + dialog visibility). Not reused after web/E2E changes — full re-run required and completed.

## Asset library E2E (`phase5-asset-library`)

**Log (standalone):** same commit run embedded in acceptance log · **6 passed (~1.4m in bundle)**

| # | Test | Evidence |
|---|------|----------|
| 1–4 | REAL library UI @ desktop1920 / 1440 / tablet / mobile390 | DnD upload, MP4 READY + playback, preview, download, search/filters/pagination, rename, guarded delete, STYLE / FIRST_FRAME / LAST_FRAME refs, timeline assign + Save + **F5**, lineage UI where applicable |
| 5 | **native «Загрузить» file input (no DnD)** | `uploadViaLibraryFilePicker`: click `asset-upload`, inject `FileList` on `asset-library-file-input`, `change` → init → PUT → complete → **READY** → card in grid → F5 |
| 6 | IDOR (user B) | Denied cross-project access |

**Upload paths (both required for sign-off):**

- **DnD:** `DataTransfer` on `data-testid="asset-library"` — production-realistic bulk path.  
- **File picker (E2E):** real `<input type="file">` + React `onChange` on deployed web; Playwright uses in-page `File` + `change` (not library drop zone).  
- **MP4:** `public/demo-assets/shotbro-demo.mp4` (ffprobe-valid h264 on VPS).

## Timeline / references / IDOR / lineage

- **Timeline:** PATCH on Save; assert `tracks[].clips[].assetId`; reload persists.  
- **References:** attach/detach + cross-project isolation (5F + 5J).  
- **IDOR:** integration + E2E user B.  
- **Lineage:** `generated_from` for mock provider ingest only; manual uploads **no** invented `asset_relation` rows.

## Remaining blockers

**None** for Phase 5J formal acceptance.

Optional (non-blocking): redeploy API with pinned `org.shotbro.build-sha` matching git short SHA; reduce standalone picker test duration under load.

## Phase 5K

Architectural plan only — see **Phase 5K — Agent Integration (plan)** in `PHASE5-PROGRESS.md`. Implementation **not started**.
