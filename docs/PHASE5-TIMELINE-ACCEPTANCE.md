# Phase 5I — Timeline acceptance

**Git HEAD (branch `phase5/creative-studio`):** `d3393bd` (smoke script fixes; functional feature stack from `e66b930`).

## Runtime truth (VPS staging, verified 2026-10-25)

| Service | Label `org.shotbro.build-sha` | Image ID | Notes |
|---------|-------------------------------|----------|--------|
| Web (`infra-web-1`) | `e66b930` | `sha256:e14e30879cba…` | Timeline UI deployed |
| API (`ai-shotbro-staging-api-1`) | `7d5bb58` | `sha256:bdcab1ae7805…` | Timeline API + agent tools; **not** re-tagged `e66b930` (apk wget I/O failed on build; rolled back). Functionally ≥ `9743f03`. |
| Worker (`ai-shotbro-staging-worker-1`) | `e66b930` | `sha256:8d5c9cdb6fd4…` | `timeline-assembly.ts` present; `assembleFromTimeline` wired |

**VPS git checkout:** `e66b930` at `HEAD` with **local modifications** under `infra/scripts/*` (not auto-reset). Stashes present — do not `reset --hard` without review.

## Gate matrix

| Gate | Status |
|------|--------|
| IMPLEMENTED | YES — schema, API, UI, worker, agent tools |
| PERSISTED | YES — `production_document` TIMELINE v2 |
| WIRED | YES — graph snapshot + worker assembly |
| VISIBLE | YES — Creative Timeline tab (web `e66b930`) |
| TESTED | **PARTIAL** — Timeline API smoke PASS; Playwright/ffmpeg matrix in progress |
| DEPLOYED | **PARTIAL** — web + worker `e66b930`; API runtime `7d5bb58` |

## Timeline API smoke (VPS)

Script: `infra/scripts/staging-phase5i-timeline-api-smoke.sh` (run via `git show FETCH_HEAD:…`).

Latest run: **10/10 PASS** — create project, storyboard seed, sync, GET/PATCH/reorder, duration, revision **409**, validate, prepare-assembly (snapshot with `timelineVersion`, `timelineHash`).

## FFmpeg matrix (14 cases)

| # | Case | Status |
|---|------|--------|
| 1–14 | See Phase 5I spec | **NOT RUN** in this session — pending dedicated VPS script / manual ffprobe after mock assembly |

Worker is on timeline assembly code path; **order/duration proof via ffprobe** still required for formal close.

## Playwright

| Suite | Status |
|-------|--------|
| `regression-strict` (8 tests, retries=0) | **IN PROGRESS** — log `/tmp/phase5i-regression-strict.log`; desktop phase3 + phase4 **PASS** early in run |
| `phase5-timeline` | NOT RUN |
| `phase5-assembly` | NOT RUN |
| `phase5-prompts` / `phase5-providers` | NOT RUN |

## Regression 7/8 history

Desktop Phase 4 unified MP4 failure was addressed in `phase4-unified-production.spec.ts` (reload pin + API asset poll + UI regex). **Re-verify** via `regression-strict` 8/8 first attempt.

## Deploy / infra notes

- Stale parallel worker build `9743f03` **terminated**; worker `e66b930` promoted successfully.
- API build `e66b930` failed: `apk add wget` **I/O error** → rollback touched `shotbro/api:rollback` (`f180fa0`); **manually restored** `shotbro/api:current` (`7d5bb58`).
- `infra/Dockerfile.api`: wget install **retry loop** (`3f182f4`) for next API promote.
- Disk ~**35 GiB** free (~70% used) after builds; no volume prune.

## Remaining blockers for formal Phase 5I close

1. API image label aligned to `e66b930` or documented equivalent (successful promote after wget retry).
2. **FFmpeg matrix** with ffprobe + reorder proof (A→C→B).
3. **Playwright:** `phase5-timeline` (4 viewports), `phase5-assembly`, `regression-strict` **8/8 PASS**, prompts/providers/creative regressions.
4. Docs sync: `PHASE5-PROGRESS.md`, architecture/data-model/ffmpeg docs with final SHAs and test logs.

**Production cutover:** NOT PERFORMED.
