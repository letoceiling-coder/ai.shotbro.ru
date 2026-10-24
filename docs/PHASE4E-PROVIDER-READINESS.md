# Phase 4E — Provider readiness (no live inference)

**Branch:** `phase4/intelligent-production`  
**Docs checkpoint (4D):** `ea34523`  
**Staging runtime (unchanged until redeploy):** `b1de217`  
**4E implementation:** local working tree (see `git rev-parse HEAD` after merge)

## Policy (unchanged)

| Flag | Required value |
|------|----------------|
| `AI_MOCK_MODE` | `true` |
| `PROVIDER_LIVE_EXECUTION_ENABLED` | `false` |
| `OPENROUTER_ENABLED` | `false` |
| `OPENROUTER_ALLOW_PAID_REQUESTS` | `false` |
| `LIVE_APPROVED` runtime | **not enabled** |

No live text/image/video/TTS generation was performed for this acceptance. Contract tests use `MockHttpTransport` only.

## Provider status matrix

| Provider | Adapter | Contract tests | Runtime wiring | Staging | Status |
|----------|---------|----------------|----------------|---------|--------|
| mock LLM | fixtures | unit | yes | mock | **MOCK_READY** · **BLOCKED_BY_POLICY** |
| OpenRouter LLM | `OpenRouterLlmAdapter` | `openrouter.contract.test.ts` + HTTP normalize | yes | disabled | **IMPLEMENTED** · **CONTRACT_TESTED** · **DEPLOYED_DISABLED** |
| mock-image | `Phase4MockImageProvider` | unit + PG | `ProviderJobManager` | mock | **MOCK_READY** · **BLOCKED_BY_POLICY** |
| mock-video | `Phase4MockVideoProvider` | unit + PG | yes | mock | **MOCK_READY** · **BLOCKED_BY_POLICY** |
| mock-elevenlabs | `Phase4MockElevenLabsProvider` | unit | yes | mock | **MOCK_READY** · **BLOCKED_BY_POLICY** |
| Fal FLUX dev | `FalFluxDevImageAdapter` | `fal-flux.contract.test.ts` | typed adapter, not default tool path | not deployed | **IMPLEMENTED** · **CONTRACT_TESTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |
| Fal MiniMax H3 video | `FalMinimaxH3VideoAdapter` | `fal-minimax-video.contract.test.ts` | typed adapter | not deployed | **IMPLEMENTED** · **CONTRACT_TESTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |
| ElevenLabs TTS | `ElevenLabsTtsAdapter` | `elevenlabs.contract.test.ts` | typed adapter | not deployed | **IMPLEMENTED** · **CONTRACT_TESTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |

Official API references (verification date **2026-03-24**):

- OpenRouter: `POST /chat/completions` @ `https://openrouter.ai/api/v1`
- Fal queue: `POST https://queue.fal.run/{model}` (FLUX dev, MiniMax H3 text-to-video)
- ElevenLabs: `POST /v1/text-to-speech/{voice_id}` @ `https://api.elevenlabs.io`

## ProviderJob SSE

- `ProviderJobManager` lifecycle hook emits deterministic `event_log` / outbox rows via `ProviderJobEventBridgeService`.
- Event types: `provider.job.created`, `provider.job.status` (payload: `from`, `to`, `status`, `version`, `providerJobId`).
- Dedupe: stable event IDs (`{jobId}:created`, `{jobId}:status:{to}:{version}`) + SSE `seen` set on reconnect.
- Web: `use-project-events.ts` listens for both types and invalidates `provider-jobs` + `agent-runs`.
- PostgreSQL remains source of truth after F5 (`GET /provider-jobs`, job row status).

Transitions persisted in `provider_job_event`: CREATED → AUTHORIZED → SUBMITTING → SUBMITTED → (QUEUED for async adapters) → RUNNING → COMPLETED | FAILED | NEEDS_RECONCILIATION | CANCELLED.

## Model catalog

- `PHASE4_MODEL_CATALOG` in `@shotbro/ai` — pricing **UNKNOWN** when not verified (never `0` for vendor models).
- HTTP: `GET /api/v1/providers/model-catalog` (read-only, reflects live env flags).

## Financial protection (verified in code paths)

- Live submit errors → `NEEDS_RECONCILIATION` (no automatic resubmit of ambiguous paid submit).
- `ExecutionPolicyEngine.assertLiveApproved` requires production approval + `approvedMaxCostUsd`.
- Budget reserve/release: existing `CostReservationService` + PG integration tests (`cost-reservation.db.integration.spec.ts`).
- Mock path unchanged; no duplicate charge paths added.

## Output ingestion

- `ProductionAssetIngestionService.ingestFromUrl` — allowlist, redirect validation, size/MIME guards, DNS safety (allowlisted fixtures skip live DNS).
- Mock provider outputs: MinIO via `ingestMockProviderOutput` (fixtures host `fixtures.shotbro.test`).

## PostgreSQL CI

- Workflow: `.github/workflows/postgres-integration.yml`
- Isolated Postgres 16 service; migrations; `RUN_DB_INTEGRATION_TESTS=1`
- Suites: `apps/api/test/db/*.db.integration.spec.ts` (provider job idempotency, events, cross-project isolation, budget)

## Automated tests (local)

| Suite | Result |
|-------|--------|
| `@shotbro/ai` vitest | **45/45 PASS** |
| `api` typecheck | **PASS** |
| PG integration | requires Docker/Postgres + `RUN_DB_INTEGRATION_TESTS=1` |
| Playwright 8/8 (staging) | **not re-run in 4E commit** — repeat before deploy sign-off |

## Remaining blockers before any live AI

1. Owner approval + per-project budget + `PROVIDER_LIVE_EXECUTION_ENABLED` + disable mock (explicit cutover plan).
2. Staging deploy of 4E API/worker/web images and smoke + Playwright regression.
3. Live credential verification (keys present ≠ model available).
4. Wire Fal/ElevenLabs adapters into tool executor behind feature flags (currently mock adapters on tool path).

## Docker / staging (baseline at 4D)

| Component | Image / tag (4D) |
|-----------|------------------|
| API | `2876d78b880d` @ `b1de217` |
| Worker | `52a2eecf8dbf` @ `b1de217` |
| Web | `shotbro-web-build:b1de217` |

Migrations **0000–0005** unchanged.
