# Phase 5L-B — Workspace Coherence & Delivery UX

**Status:** IMPLEMENTED (5L-B acceptance in progress)  
**Git:** **`20539645`** (feat) + **`c248829`** (e2e auto-nav helpers)  
**Runtime (VPS):** API/Web/Worker **`20539645`**

## Delivered

| ID | Item | Key paths |
|----|------|-----------|
| **5L-4** | Central React Query invalidation after agent/creative/SSE/approvals | `apps/web/src/lib/invalidate-creative-project-queries.ts`, `use-real-studio.ts`, `use-project-events.ts`, `approval-card.tsx` |
| **5L-5** | Optional auto-nav to `creativeSection` after successful `agent_tool_result` | `use-agent-workspace-sync.ts`, `studio-store.ts` (`creativeAutoNavigate`), `settings-sheet.tsx`, `creative-section-nav.tsx` (`data-active`) |
| **5L-6** | Stable `shotbro-asset://` playback ref + Asset API signed URLs + inline players | `packages/contracts/src/asset-playback.ts`, `apps/worker/src/production-run.ts`, `assets.service.ts` (video preview), `video-result-card.tsx`, `production-section.tsx`, `use-asset-media-url.ts` |

## Tests

| Suite | Path |
|-------|------|
| Asset playback unit | `packages/contracts/test/asset-playback.spec.ts` |
| Preview policy unit | `apps/api/test/unit/asset-preview-video.spec.ts` |
| Unified studio E2E | `apps/web/e2e/phase5-unified-studio.spec.ts` |
| VPS runner | `infra/scripts/phase5l-b-acceptance-e2e.sh` |

## Mock policy

Unchanged: `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false`.

## Not in 5L-B

**5L-C** (scene job gallery, brief smoke bundle, full `PHASE5L_ALL_PASS`) — not started.

## VPS evidence (partial)

| Run | Result |
|-----|--------|
| Idempotency + media guard | PASS |
| `regression-strict` | **8/8** (~13m) @ deploy **`20539645`** |
| `phase5-agent-integration` | 1/2 then e2e helper fixes — re-run after **`c248829`** |
| `phase5-unified-studio` | pending full run |

```bash
bash /var/www/ai.shotbro.ru-src/infra/scripts/phase5l-b-acceptance-e2e.sh
```

Expected marker: **`PHASE5L_B_ALL_PASS`**
