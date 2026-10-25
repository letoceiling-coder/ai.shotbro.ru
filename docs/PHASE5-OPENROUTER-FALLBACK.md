# Phase 5 — OpenRouter fallback

## Media adapters (mock contract tested)

| Adapter | Endpoint | Operation |
|---------|----------|-----------|
| `OpenRouterImageAdapter` | `POST /images` | TEXT_TO_IMAGE |
| `OpenRouterVideoAdapter` | `POST /videos`, `GET /videos/{id}` | TEXT_TO_VIDEO |
| `OpenRouterTtsAdapter` | `POST /audio/speech` | TEXT_TO_SPEECH |

Existing `OpenRouterLlmAdapter` remains for chat completions.

## Fallback mapping (simulation)

| Primary unavailable | Fallback candidate |
|--------------------|--------------------|
| Fal image | `openrouter/image/auto` |
| Fal video | `openrouter/video/auto` |
| ElevenLabs TTS | `openrouter/tts/auto` |
| Magnific upscale | **none** unless verified equivalent → `NO_COMPATIBLE_FALLBACK` |

## Voice consistency

`strictVoiceConsistency=true` blocks TTS fallback (no automatic OpenRouter voice swap).

OpenRouter fallback voice is **not** guaranteed to match ElevenLabs voiceId.

## API

`POST /api/v1/providers/route-plan` — returns plan + `mockRoutingOnly` flag.
