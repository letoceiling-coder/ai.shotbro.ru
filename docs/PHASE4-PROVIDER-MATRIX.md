# Phase 4 — Provider matrix

| Provider | Adapter | Persistence | Contract tests | Live verified |
|----------|---------|-------------|----------------|---------------|
| mock LLM | LlmGateway fixtures | n/a | **TESTED** | **BLOCKED BY POLICY** |
| openrouter LLM | `OpenRouterLlmAdapter` | n/a | **CONTRACT_TESTED** | **BLOCKED BY POLICY** |
| mock-image | `Phase4MockImageProvider` | `provider_job` | unit + PG | **BLOCKED BY POLICY** |
| mock-video | `Phase4MockVideoProvider` | `provider_job` | unit + PG | **BLOCKED BY POLICY** |
| mock-elevenlabs | `Phase4MockElevenLabsProvider` | `provider_job` | unit | **BLOCKED BY POLICY** |
| Fal FLUX dev (`fal-ai/flux/dev`) | `FalFluxDevImageAdapter` | — | **CONTRACT_TESTED** (mock HTTP) | **LIVE_UNVERIFIED** · **BLOCKED BY POLICY** |
| Fal MiniMax H3 video | `FalMinimaxH3VideoAdapter` | — | **CONTRACT_TESTED** (mock HTTP) | **LIVE_UNVERIFIED** · **BLOCKED BY POLICY** |
| ElevenLabs TTS | `ElevenLabsTtsAdapter` | — | **CONTRACT_TESTED** (mock HTTP) | **LIVE_UNVERIFIED** · **BLOCKED BY POLICY** |

HTTP default: `BlockedHttpTransport` / execution policy `MOCK_ONLY`.

Tool execution path (Phase 4E): still **mock** image/video/TTS providers; typed vendor adapters are ready for gated wiring.

Migration: **`0005_provider_jobs.sql`**

See **`PHASE4E-PROVIDER-READINESS.md`** for SSE, CI, catalog, and acceptance details.
