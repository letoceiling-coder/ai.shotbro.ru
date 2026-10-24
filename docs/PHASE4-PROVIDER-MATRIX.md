# Phase 4 — Provider matrix

| Provider | Adapter | Persistence | Contract tests | Live verified |
|----------|---------|-------------|----------------|---------------|
| mock LLM | LlmGateway fixtures | n/a | **TESTED** | **BLOCKED BY POLICY** |
| openrouter LLM | `OpenRouterLlmAdapter` | n/a | **CONTRACT_TESTED** | **BLOCKED BY POLICY** |
| mock-image | `Phase4MockImageProvider` | `provider_job` | unit | **BLOCKED BY POLICY** |
| mock-video | `Phase4MockVideoProvider` | `provider_job` | unit | **BLOCKED BY POLICY** |
| mock-elevenlabs | `Phase4MockElevenLabsProvider` | `provider_job` | unit | **BLOCKED BY POLICY** |
| vendor image (e.g. Flux) | **ADAPTER_PENDING** | — | — | **NOT IMPLEMENTED** |
| vendor video | **ADAPTER_PENDING** | — | — | **NOT IMPLEMENTED** |
| ElevenLabs live | **ADAPTER_PENDING** | — | — | **NOT IMPLEMENTED** |

HTTP default: `BlockedHttpTransport` / execution policy `MOCK_ONLY`.

Migration: **`0005_provider_jobs.sql`**
