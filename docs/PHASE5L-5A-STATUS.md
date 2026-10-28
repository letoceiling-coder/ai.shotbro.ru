# Phase 5L-A — Safety & Routing (implementation status)

**Status:** IMPLEMENTED (pending VPS E2E sign-off)  
**Baseline:** builds on Phase 5K ACCEPTED (`891769f` docs + prior runtime)

## Delivered

| ID | Item | Files |
|----|------|-------|
| **5L-1** | Unified `resolveStudioMessageIntent` | `packages/ai/src/agent/studio-intent.ts`, web re-export `apps/web/src/lib/agent-message-routing.ts`, `use-real-studio.ts` |
| **5L-3** | `creative-turn` HTTP idempotency (`runWithClaim`) | `apps/api/src/common/idempotency.service.ts`, `agent.service.ts`, `agent.module.ts` |

## Tests

| Suite | Path |
|-------|------|
| Studio intent unit | `packages/ai/test/studio-intent.spec.ts` |
| Routing regression | `packages/ai/test/agent-routing.spec.ts` |
| Idempotency key unit | `apps/api/test/unit/creative-turn-idempotency.spec.ts` |
| Idempotency integration | `apps/api/test/integration/phase5l-creative-idempotency.integration.spec.ts` |

## Not in 5L-A

5L-B (query invalidation, delivery URL) and 5L-C (gallery, final acceptance script) — **not started**.
