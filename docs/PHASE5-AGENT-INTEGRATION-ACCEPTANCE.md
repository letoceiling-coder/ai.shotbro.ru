# Phase 5K — Agent Integration acceptance

**Status:** **ACCEPTED** (staging VPS `85.117.235.93`, Git/runtime **synchronized 2026-10-29**)

## Git ↔ runtime (source of truth)

| Location | `phase5/creative-studio` HEAD | Notes |
|----------|-------------------------------|--------|
| Local | **`32ba9726`** | includes **`1ff15ac`** + docs commit |
| `origin` (GitHub) | **`32ba9726`** | pushed; VPS tracks this ref |
| VPS checkout | **`32ba9726`** | clean tree (only deploy artifacts untracked: `DEPLOYED.txt`, `.deploy/`) |

### Why `f5fbbf6` vs `1ff15ac`?

Initial commit for the live ordinal tool was created as **`f5fbbf6`**, then **`git commit --amend`** (doc table row in the same commit) produced **`1ff15ac`** with the **same message**. **`f5fbbf6` is not on any branch** — use **`1ff15ac`** in the history and **`32ba9726`** as deploy/docs HEAD.

## Runtime labels (`org.shotbro.build-sha`)

| Service | SHA | Rebuilt on sync? |
|---------|-----|------------------|
| **API** | **`32ba9726`** | Yes — `staging-deploy-staging-stack.sh api 32ba9726` |
| **Web** | **`b6e19bf5`** | No — unchanged since bootstrap isolation |
| **Worker** | **`366716e`** | No |

**Ordinal fix in running API:** `set_scene_first_frame_by_ordinal` present in `packages/ai/src/agent/creative-llm-tools.ts` inside container (matches git `32ba9726`).

**Health (post-deploy):** `/api/v1/health/live` ok, `/api/v1/health/ready` ready.

## Acceptance evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Full sequential E2E (baseline) | **PASS** | `/var/log/shotbro-e2e/phase5k-acceptance-5c7facb7.log` → **`PHASE5K_ALL_PASS`** @ `2026-10-28T21:05:53+00:00` (git **`5c7facb7`**, Web **`b6e19bf5`**) |
| Post-sync regression | **PASS 8/8** | `staging-playwright-e2e.sh regression-strict` after API **`32ba9726`** deploy (~9.5m) |
| Media guards | **PASS** | `PHASE5K_MEDIA_GUARD_PASS` |
| Live OpenRouter smoke | **PASS** | `PHASE5K_LIVE_LLM_SMOKE_PASS` |
| Live mutation + API F5 | **PASS** | `PHASE5K_LIVE_MUTATION_SMOKE_PASS` |
| Paid provider jobs (live smokes) | **0** | mock-only provider jobs |

### Suite results (baseline log `phase5k-acceptance-5c7facb7.log`)

| Suite | Result |
|-------|--------|
| `phase5-agent-integration` | 2 passed (3.2m) |
| `regression-strict` | 8 passed (9.4m) |
| `phase5-user-journey` | 4 passed (8.4m) |
| `phase5-asset-library` | 6 passed (29.1s) |
| `phase5-storyboard` | 5 passed (43.7s) |
| `phase5-characters` | 4 passed (19.1s) |
| `phase5-references` | 5 passed (21.6s) |
| `phase5-creative-flow` | 1 passed (13.9s) |
| `phase5-prompts` | 4 passed (16.1s) |
| `phase5-providers` | 16 passed (1.1m) |
| `phase5-timeline` | 4 passed (18.2s) |
| `phase5-assembly` | 1 passed (20.7s) |

**F5 (UI):** `phase5-agent-integration` desktop1920 — reload → stable `firstFrameAssetId` (mock `phase5k:`).

**F5 (live API):** `phase5k-live-mutation.integration.spec.ts` — two consecutive `GET /storyboard`.

## Recovery commits (5K chain)

| SHA | Summary |
|-----|---------|
| `b6e19bf` | Isolate production bootstrap from live `creative-turn` |
| `46e00ca` | Safe `fetchStoryboardDocument` during publish |
| `bbf4f28` | Tablet `ensureRealCreateVisible` reload retry |
| `5c7facb` | `createProjectViaDialog` without failing `scrollIntoViewIfNeeded` |
| `1ff15ac` | Live LLM: `set_scene_first_frame_by_ordinal` + mutation smoke script |
| `32ba972` | Docs: amend note; post-acceptance SHA alignment |

OpenRouter / agent: `23b00c8` … `41e3f8b`. RCA: `docs/PHASE5K-PRODUCTION-REGRESSION-RCA.md`.

## Commands

```bash
git fetch origin && git reset --hard origin/phase5/creative-studio   # VPS
bash infra/scripts/staging-deploy-staging-stack.sh api "$(git rev-parse --short HEAD)" /var/www/ai.shotbro.ru-src
bash infra/scripts/phase5k-media-guard-smoke.sh
bash infra/scripts/phase5k-live-llm-smoke.sh
bash infra/scripts/phase5k-live-mutation-smoke.sh
bash infra/scripts/staging-playwright-e2e.sh /var/www/ai.shotbro.ru-src regression-strict
```

## Phase 5L

**Not started.**
