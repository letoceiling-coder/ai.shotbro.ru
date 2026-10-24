# Phase 5 — Magnific integration

**Status:** CONTRACT_TESTED · **Live calls:** BLOCKED_BY_POLICY  
**Verified:** 2026-10-25 against [Magnific Upscaler Creative POST](https://docs.magnific.com/api-reference/image-upscaler-creative/post-image-upscaler)

## Confirmed API (no live requests performed)

| Item | Value |
|------|--------|
| Base URL | `https://api.magnific.com` |
| Upscale | `POST /v1/ai/image-upscaler` |
| Status | `GET /v1/ai/image-upscaler/{task-id}` |
| Auth | Header `x-magnific-api-key` |
| Async | Returns `data.task_id`, poll or `webhook_url` |

Request fields validated in `MagnificUpscaleRequestSchema`: `image`, `scale_factor` (2x/4x/8x/16x), `optimized_for`, `prompt`, `creativity`, `hdr`, `resemblance`, `fractality`, `engine`, optional `webhook_url`.

Pricing: output-area based (EUR tiers in vendor docs) — **priceStatus UNKNOWN** in catalog until per-project metering wired.

## Video capabilities

| Capability | Status |
|------------|--------|
| VIDEO_GENERATION | Separate Magnific video APIs (Seedance, PixVerse, etc.) — **ADAPTER_PENDING** per product scope |
| VIDEO_UPSCALING | Not merged into image upscaler — **UNVERIFIED / ADAPTER_PENDING** |
| VIDEO_ENHANCEMENT | **ADAPTER_PENDING** |
| FRAME_RATE_ENHANCEMENT | **ADAPTER_PENDING** |

No third-party aggregator endpoints impersonating Magnific.

## Code

- `MagnificImageUpscalerAdapter` / `MagnificProviderAdapter` — `packages/ai/src/providers/magnific-image-upscaler-adapter.ts`
- Contract tests — `magnific-image-upscaler.contract.test.ts` (MockHttpTransport only)
- Registry — `magnific/image-upscaler-creative` in `PHASE4_MODEL_CATALOG`, execution **BLOCKED_BY_POLICY**
- Mock path — `mock/magnific-upscale` for pipeline tests
