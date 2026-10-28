# Phase 5K — Agent Integration acceptance

**Status:** **ACCEPTED** (2026-10-28, VPS staging `85.117.235.93`)

## Runtime (VPS)

| Service | `org.shotbro.build-sha` | Notes |
|---------|-------------------------|--------|
| API | **b6e19bf5** | Production bootstrap isolation; live OpenRouter via proxy |
| Web | **b6e19bf5** | Bootstrap → `createRun`; creative NL routing |
| Worker | **366716e** | Mock media / upload READY |
| Git (E2E acceptance) | **5c7facb7** | `/var/www/ai.shotbro.ru-src`, branch `phase5/creative-studio` |
| API (live ordinal tool) | **rebuilt on VPS** after `5c7facb7` | `set_scene_first_frame_by_ordinal` exposed to OpenRouter tool list |

## Acceptance evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Full sequential E2E | **PASS exit 0** | `/var/log/shotbro-e2e/phase5k-acceptance-5c7facb7.log` → **`PHASE5K_ALL_PASS`** @ `2026-10-28T21:05:53+00:00` |
| Live OpenRouter smoke | **PASS** | `phase5k-live-llm-smoke.sh` → `PHASE5K_LIVE_LLM_SMOKE_PASS` |
| Live mutation + API F5 | **PASS** | `phase5k-live-mutation-smoke.sh` → `PHASE5K_LIVE_MUTATION_SMOKE_PASS` |
| Media guards | **PASS** | `phase5k-media-guard-smoke.sh` → `PHASE5K_MEDIA_GUARD_PASS` |
| Paid provider jobs (live smokes) | **0** | provider-jobs mock-only |

### Suite results (`phase5k-acceptance-5c7facb7.log`)

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

**F5 (UI):** `phase5-agent-integration` desktop1920 test — reload after pin → `firstFrameAssetId` unchanged (mock `phase5k:` planner, no OpenRouter spend).

**F5 (live API):** `phase5k-live-mutation.integration.spec.ts` — two consecutive `GET /storyboard` after live `set_scene_first_frame_by_ordinal`.

## Recovery commits (5K chain)

| SHA | Summary |
|-----|---------|
| `b6e19bf` | Isolate production bootstrap from live `creative-turn` |
| `46e00ca` | Safe `fetchStoryboardDocument` during publish |
| `bbf4f28` | Tablet `ensureRealCreateVisible` reload retry |
| **`5c7facb`** | **`createProjectViaDialog`**: click without failing `scrollIntoViewIfNeeded` |
| **`f5fbbf6`** | Live LLM: expose `set_scene_first_frame_by_ordinal`; `phase5k-live-mutation-smoke.sh` |

OpenRouter / agent path: `23b00c8` … `41e3f8b` (transport, tool_calls shape, E2E asserts). RCA: `docs/PHASE5K-PRODUCTION-REGRESSION-RCA.md`.

## Commands

```bash
bash infra/scripts/phase5k-configure-staging-llm.sh
bash infra/scripts/phase5k-media-guard-smoke.sh
bash infra/scripts/phase5k-live-llm-smoke.sh
bash infra/scripts/phase5k-live-mutation-smoke.sh
bash infra/scripts/phase5k-acceptance-e2e.sh /var/www/ai.shotbro.ru-src /var/log/shotbro-e2e
```

## Phase 5L

**Not started.**
