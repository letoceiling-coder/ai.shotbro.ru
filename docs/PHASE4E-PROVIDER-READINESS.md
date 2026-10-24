# Phase 4E — Provider readiness (staging release)

**Branch:** `phase4/intelligent-production`  
**Git HEAD (4E):** `4a3896f` (+ E2E flake fix commit if pushed after)  
**Remote:** `origin/phase4/intelligent-production` @ `4a3896f`  
**Staging deployed SHA:** `4a3896f`  
**Prior staging:** `b1de217` → `ea34523` (docs only)

## Policy (verified on staging API container)

| Flag | Staging value |
|------|----------------|
| `AI_MOCK_MODE` | **true** |
| `OPENROUTER_ENABLED` | **false** |
| `OPENROUTER_ALLOW_PAID_REQUESTS` | **false** |
| `PROVIDER_LIVE_EXECUTION_ENABLED` | **false** |
| `PHASE4_AGENT_RUNTIME_ENABLED` | **false** (global) |
| `LIVE_APPROVED` | **not enabled** |

**Confirmed:** Real OpenRouter inference **0** · Real Fal image **0** · Real Fal video **0** · Real ElevenLabs TTS **0** · Production cutover **NOT PERFORMED**.

## Provider status matrix

| Provider | Adapter | Contract | Runtime tool path | Staging | Status |
|----------|---------|----------|-------------------|---------|--------|
| mock LLM | fixtures | unit | yes | mock | **MOCK_READY** · **BLOCKED_BY_POLICY** |
| OpenRouter LLM | `OpenRouterLlmAdapter` | **CONTRACT_TESTED** | gateway | disabled | **IMPLEMENTED** · **DEPLOYED_DISABLED** |
| mock-image/video/TTS | Phase4 mock | unit + PG | **yes** | mock | **STAGING_TESTED** · **BLOCKED_BY_POLICY** |
| Fal FLUX dev | `FalFluxDevImageAdapter` | **CONTRACT_TESTED** | not wired | n/a | **IMPLEMENTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |
| Fal MiniMax H3 video | `FalMinimaxH3VideoAdapter` | **CONTRACT_TESTED** | not wired | n/a | **IMPLEMENTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |
| ElevenLabs TTS | `ElevenLabsTtsAdapter` | **CONTRACT_TESTED** | not wired | n/a | **IMPLEMENTED** · **LIVE_UNVERIFIED** · **BLOCKED_BY_POLICY** |

Official API references (verification **2026-03-24**, no live calls):

- OpenRouter: `POST /chat/completions` @ `https://openrouter.ai/api/v1`
- Fal queue: `POST https://queue.fal.run/fal-ai/flux/dev`, `POST https://queue.fal.run/minimax/h3/text-to-video`
- ElevenLabs: `POST /v1/text-to-speech/{voice_id}` @ `https://api.elevenlabs.io`

## Staging deployment (2026-10-24)

| Component | ID / tag |
|-----------|----------|
| API image | `ai-shotbro-staging-api:latest` → `sha256:4956f5b816c445f7e02b93c87b908d0935191a7df408f25b7d19fd288bbfa971` |
| Worker image | `ai-shotbro-staging-worker:latest` → `sha256:b43c2b55bae0b66c14a819f0ee34a5bccad82a5c1a68b9a1ea52b9264a8271a3` |
| Web build | `shotbro-web-build:4a3896f` → `43ba63bd36ab` (systemd @ `:3020`) |
| `DEPLOYED.txt` | **4a3896f** |
| PG backup | `/var/backups/shotbro-staging-4e.sql.gz` (451304 bytes) + isolated restore test **OK** |
| Migrations | **0000–0005** (0005 not re-applied) |

Deploy path: tarball `phase4-deploy-4a3896f.tar` → `staging-hotfix-deploy.sh` (api/worker) → `staging-deploy-web.sh` (bash).

## ProviderJob SSE

- `ProviderJobManager` lifecycle → `ProviderJobEventBridgeService` → `event_log` / outbox.
- Types: `provider.job.created`, `provider.job.status` (dedupe IDs `{jobId}:created`, `{jobId}:status:{to}:{version}`).
- Web: `use-project-events.ts` invalidates `provider-jobs` + `agent-runs`.
- **STAGING_TESTED** indirectly via Phase 3/4 production smokes + Playwright (mock provider jobs on tool path).

Dedicated SSE matrix (created→completed, reconnect, cross-project): **partial** — recommend follow-up automated API test against `events/stream`.

## CI

| Job | Result |
|-----|--------|
| GitHub Actions `postgres-integration.yml` | **BLOCKED** — `gh` not authenticated in release environment; verify run at https://github.com/letoceiling-coder/ai.shotbro.ru/actions |
| Local Docker PG (Windows agent) | **BLOCKED** — Docker daemon not running |
| `@shotbro/ai` vitest | **52/52 PASS** (includes contract + `vendor-adapters-blocked`) |
| API/worker/web typecheck | **PASS** |

## Regression

| Test | Result |
|------|--------|
| VPS Phase 3 API smoke | **PASS** (`mock:true`) |
| VPS Phase 4 unified smoke | **PASS** (`mock:true`) |
| Playwright 8 viewport matrix | **8/8 PASS** (desktop1440 Phase 3 retried after send-button flake fix) |
| Provider catalog `GET /api/v1/providers/model-catalog` | **PASS** (staging loopback) |

## Security (4E)

- Default HTTP: `BlockedHttpTransport` / `ExecutionPolicyEngine` **MOCK_ONLY** on staging.
- Vendor keys in env do **not** bypass policy (`vendor-adapters-blocked.test.ts`).
- No public live-generation API; catalog is read-only metadata.
- Asset ingestion: SSRF/redirect/size/MIME tests in `@shotbro/ai`.
- Unknown vendor pricing: **UNKNOWN** in catalog (not zero).

## Remaining blockers (before live AI)

1. Owner approval + budget + explicit `PROVIDER_LIVE_EXECUTION_ENABLED` / mock off (separate cutover).
2. Wire Fal/ElevenLabs into `generate.*` tool path behind flags.
3. GitHub Actions PG job: confirm green on `4a3896f` push.
4. Optional: dedicated ProviderJob SSE integration test on isolated DB.

## Git

- Commit: `4a3896f` — `phase4: add vendor provider contracts and provider job events`
- Push: `origin/phase4/intelligent-production` updated (`ea34523..4a3896f`)
