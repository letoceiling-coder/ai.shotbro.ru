# Phase 5L-A — Safety & Routing (implementation status)

**Status:** **ACCEPTED** (staging VPS `85.117.235.93`, 2026-10-29)  
**Git (local / origin):** **`42a37853`** (5L-A feat `e06182c8` + acceptance scripts/tests)  
**VPS src checkout:** **`42a37853`** · **API/Web runtime:** **`e06182c8`** (unchanged since 5L-A deploy)  
**Baseline:** Phase 5K ACCEPTED; audit docs at **`891769f`** (ancestor of HEAD)

## Delivered

| ID | Item | Files |
|----|------|-------|
| **5L-1** | Unified `resolveStudioMessageIntent` (bootstrap vs creative vs default) | `packages/ai/src/agent/studio-intent.ts`, `creative-intent-planner.ts`, `creative-agent-runtime.ts`, `apps/web/src/lib/agent-message-routing.ts`, `use-real-studio.ts` |
| **5L-3** | `creative-turn` HTTP idempotency (`runWithClaim`, scoped key) | `apps/api/src/common/idempotency.service.ts`, `agent.service.ts`, `agent.module.ts` |

## Tests

| Suite | Path | Local | VPS |
|-------|------|-------|-----|
| Studio intent unit | `packages/ai/test/studio-intent.spec.ts` | PASS | — |
| Routing regression | `packages/ai/test/agent-routing.spec.ts` | PASS | — |
| Idempotency key unit | `apps/api/test/unit/creative-turn-idempotency.spec.ts` | PASS | — |
| Idempotency integration | `apps/api/test/integration/phase5l-creative-idempotency.integration.spec.ts` | optional | **`phase5l-creative-idempotency-smoke.sh`** |
| Agent integration E2E | `e2e/phase5-agent-integration.spec.ts` | — | **2/2** |
| Production regression | `regression-strict` | — | **8/8** |
| Media guard | `phase5k-media-guard-smoke.sh` | — | **`PHASE5K_MEDIA_GUARD_PASS`** |

### VPS evidence logs

| Run | Log path | Result |
|-----|----------|--------|
| `phase5-agent-integration` | `/var/log/shotbro-e2e/phase5-agent-integration-c2403dbc.log` | **2/2** (~3.2m), runtime `e06182c8` |
| `regression-strict` | `/var/log/shotbro-e2e/regression-strict-c2403dbc.log` | **8/8** (~9.4m), `retries=0` |
| Creative idempotency | `infra/scripts/phase5l-creative-idempotency-smoke.sh` @ **`42a37853`** | **3/3** · `PHASE5L_CREATIVE_IDEMPOTENCY_SMOKE_PASS` |
| Media guard | `phase5k-media-guard-smoke.sh` @ **`42a37853`** | `PHASE5K_MEDIA_GUARD_PASS` |

**Acceptance runner:** `infra/scripts/phase5l-a-acceptance-e2e.sh` (API smokes first, then Playwright — avoids throttler 429 on integration).

**Runtime labels:** API/Web `org.shotbro.build-sha` = **`e06182c8`**; Worker unchanged **`366716e`**.

## Mock policy (unchanged)

`AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false` — no paid image/video jobs during 5L-A.

## Not in 5L-A

**5L-B** (query invalidation, delivery URL) and **5L-C** (gallery, full `PHASE5L_ALL_PASS` script) — **not started**. Full Phase 5L is **not** complete.

## Known gaps / risks

- Local API `typecheck` may fail on pre-existing `phase5k-live-*.integration.spec.ts` typings; VPS Docker API build passes.
- `@shotbro/ai` full test suite: unrelated `magnific-image-upscaler.contract.test.ts` needs S3 env locally.
- Concurrent duplicate `creative-turn` while in-flight → **409** (by design); clients should retry with same key after completion.
