# Phase 5 — UI / capability audit (baseline)

**Date:** 2026-10-25  
**Git baseline:** `dde4cdb` (Phase 4F) → branch `phase5/creative-studio`  
**Staging runtime (pre–Phase 5 deploy):** web `9c22914`, API/worker `4b127c7`

## Product gap summary

Today REAL mode is **chat-first**: script, storyboard, and production artifacts appear as **message blocks** (`ScriptCard`, `StoryboardViewer`, `ProductionBoardCard`). PostgreSQL holds authoritative documents (`production_document`, `prompt_version`, project memory characters), but there is **no unified production workspace** to browse and edit all objects in one place. Phase 5 closes that gap without a second product shell.

## Capability matrix

| Capability | Backend | Frontend | Persistence | Visible (REAL) | Editable | Tested | Missing / notes |
|------------|---------|----------|-------------|----------------|----------|--------|-----------------|
| Studio shell / sidebar | yes | `StudioShell`, `StudioSidebar` | projects API | yes | title/settings | Phase 3/4 E2E | — |
| AI chat + composer | yes | `RealThread`, `RealComposer` | conversations/messages | yes | send | strict 8/8 | — |
| Agent run strip | yes | `AgentRunStrip` | agent_runs | yes | — | partial | deeper trace UX |
| Creative brief | yes | chat blocks only → **Brief tab (5B)** | `BRIEF` doc | after agent | — | — | full brief editor |
| Production plan | yes | chat / plan blocks | `PRODUCTION_PLAN` | partial | tool only | Phase 4 | workspace view |
| Script (document) | yes | `ScriptCard` (read) → **ScriptEditor (5C)** | `SCRIPT` doc versioning | chat only → tab | PATCH scene (API) | integration smoke | scene CRUD UI, meta fields |
| Storyboard | yes | `StoryboardViewer` (read) | `STORYBOARD` doc | chat only | tool only | — | grid, frames, assets (5D) |
| Scene prompts | yes | — | `prompt_version` | no | API POST | — | Prompt Studio UI (5G) |
| Characters | partial | — | `project_memory.characters` | no | API POST | — | Character Studio (5E) |
| References | stub | — | delegate only | no | attach stub | — | persistence + UI (5F) |
| Model strategy | yes | `ModelSelector`, context tab | project settings | partial | strategy | — | per-scene models (5H) |
| Approvals | yes | `ApprovalCard` | approvals + hash | yes | approve | strict | targeted invalidation UI (5L) |
| Production graph | yes | context tab, `ProductionBoardCard` | graph nodes | partial | — | integration | workspace Production (5B+) |
| Provider jobs (mock) | yes | context tab | provider_jobs | partial | — | Phase 4 | storyboard gen status (5D) |
| Timeline | schema only | — | `TIMELINE` doc type | no | — | — | editor + FFmpeg sync (5I) |
| Asset library | yes | context Assets list | MinIO + assets | partial | upload | Phase 3 delivery | full library UX (5J) |
| Final MP4 delivery | yes | chat video block | asset + DELIVERY | yes | — | strict | link from Assets/Timeline |
| Agent tools (Phase 4) | yes | — | via ToolExecutor | — | — | evaluation fixtures | Phase 5K tool expansion |
| SSE / event log | yes | hooks | Redis/stream | partial | — | — | workspace live updates |

**Status legend:** IMPLEMENTED / WIRED / VISIBLE / TESTED / NOT IMPLEMENTED — see `PHASE5-PROGRESS.md`.

## Screenshots (baseline)

Captured on VPS via Playwright (`phase5-audit` mode):

- `apps/web/test-results/phase5-real-{desktop1920,desktop1440,tablet,mobile390}.png`
- `apps/web/test-results/phase5-script-tab-*.png`

Pre–Phase 5 branch deploy, compare with `phase4f-real-*.png` from Phase 4F audit.

## Real user gaps (priority)

1. **No single workspace** — user cannot open Script / Storyboard / Characters without scrolling chat history.  
2. **Script editing** — API supported one-field PATCH; no UI for reorder, duplicate, or rich scene fields.  
3. **Storyboard** — no first/last frame asset refs in UI; prompts not editable per scene.  
4. **Characters** — stored in memory JSON; no gallery or scene assignment UI.  
5. **References** — `attach_reference` validates ownership but does not persist links.  
6. **Timeline** — not exposed; assembly ignores user-ordered timeline JSON.  
7. **Agent context** — tools read documents; manual UI edits must invalidate approvals and appear in ContextBuilder (5K/5L).
