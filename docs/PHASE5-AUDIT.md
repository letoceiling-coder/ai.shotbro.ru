# Phase 5 — Technical audit

**Branch:** `phase5/creative-studio`  
**Baseline tag/SHA:** `dde4cdb`

## Runtime verification (2026-10-25)

| Check | Result |
|-------|--------|
| Local HEAD | `dde4cdb` → Phase 5 branch |
| VPS `/var/www/ai.shotbro.ru-src` | was `9c22914` on `phase4/intelligent-production` (pull Phase 5 after push) |
| `infra-web-1` | `shotbro-web-build:9c22914` @ :3020 |
| `ai-shotbro-staging-api-1` | healthy @ :3021 |
| `ai-shotbro-staging-worker-1` | up |
| AI policy | mock-only flags unchanged |

## Backend surfaces (existing)

- **Documents:** `ProductionDocumentService` — BRIEF, SCRIPT, STORYBOARD, TIMELINE, DELIVERY in `production_document`.  
- **Script:** PATCH scene with versioning + graph invalidation (`production-graph.service`).  
- **Characters:** `CharacterContinuityService` → `project_memory`.  
- **Prompts:** `PromptVersionService` → `prompt_version` table.  
- **Assets:** `AssetsService` + MinIO uploads.  
- **Production:** `ProductionGraphService`, BullMQ worker, FFmpeg mock delivery.  
- **Agent:** Phase 4 tools in `packages/ai/src/agent/tool-handlers/register.ts`; delegates in `agent-tool-delegates.ts`.

## Frontend surfaces (existing)

- Entry: `apps/web/src/app/studio/page.tsx` → `StudioShell`.  
- REAL chat: `RealThread` + block renderer (`ScriptCard`, `StoryboardViewer`, …).  
- REAL context: `RealContextPanel` (context, production graph, assets, models).

## Phase 5 workstreams

See `PHASE5-ARCHITECTURE.md` and `PHASE5-PROGRESS.md` for stage ownership (5A–5P).

## Risk register

| Risk | Mitigation |
|------|------------|
| Breaking Phase 3/4 strict E2E | run `regression-strict` after each deploy; keep chat path default tab |
| API/UI drift | extend `packages/contracts` first; typecheck on VPS |
| Paid AI accidental enable | env flags + staging verify script |
| Reference attach stub | implement persistence before marketing Reference Manager |
