# Phase 5 — Multi-provider architecture

## Providers

| Provider | Operations (confirmed) | Adapter status |
|----------|------------------------|----------------|
| Fal | IMAGE_GENERATION, TEXT_TO_VIDEO | CONTRACT_READY · DEPLOYED_DISABLED |
| ElevenLabs | TEXT_TO_SPEECH | CONTRACT_READY · DEPLOYED_DISABLED |
| Magnific | IMAGE_UPSCALE | CONTRACT_READY · DEPLOYED_DISABLED |
| OpenRouter | TEXT, IMAGE, VIDEO, TTS | LLM + media adapters CONTRACT_TESTED · BLOCKED_BY_POLICY |

## Router modules

- `PROVIDER_CAPABILITY_MATRIX` — provider × model × operation
- `ProviderFallbackPlanner` — primary + OpenRouter fallback simulation
- `translateCanonicalToProvider` — parameter translation with warnings
- `ProviderJobManager` — mock submit when `AI_MOCK_MODE`

## Policy gates (all required for live I/O)

1. `AI_MOCK_MODE=false`
2. `PROVIDER_LIVE_EXECUTION_ENABLED=true`
3. Per-provider switch (`FAL_PROVIDER_ENABLED`, etc.)
4. API key configured
5. OpenRouter: `OPENROUTER_ALLOW_PAID_REQUESTS` + cost approval (live only)

Individual switches **cannot** bypass global mock block.

## Failure classes

- `PRE_SUBMIT_FAILURE` → fallback may be planned
- `POST_SUBMIT_AMBIGUOUS` → `NEEDS_RECONCILIATION`, no auto fallback
