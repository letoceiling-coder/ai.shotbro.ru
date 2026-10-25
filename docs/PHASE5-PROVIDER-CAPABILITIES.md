# Phase 5 — Provider capabilities matrix

Source of truth: `packages/ai/src/providers/capability-matrix.ts`

## Operation separation (enforced)

- `IMAGE_GENERATION` ≠ `IMAGE_UPSCALE`
- `TEXT_TO_VIDEO` ≠ `IMAGE_TO_VIDEO`
- `TEXT_TO_SPEECH` ≠ voice cloning

## Verification metadata

Each entry includes `verificationDate`, `documentationUrl`, `priceStatus`, `executionStatus`.

## Fal model registry

Extensible via matrix entries — **no** shared request schema across all Fal video models (`model_specific_schema` constraint on MiniMax H3).

## Tests

- `provider-fallback.test.ts` — scenarios A–I (mock routing)
- `openrouter-media.contract.test.ts` — serialization + policy block
- Existing Fal/ElevenLabs/Magnific contract tests unchanged

Live calls: **0** (BlockedHttpTransport / MOCK_ONLY).
