# Phase 5 — User Interface Recovery (P0)

**Status:** IN PROGRESS (audit + first UX patch, 2026-10-26)  
**Goal:** Real access to implemented Creative Workspace modules without masquerading DEMO as REAL.

## Problem statement

Backend modules (AgentRuntime, Script, Storyboard, Characters, References, Prompts, Models, Timeline, assets) are deployed, but the default `/studio` experience is **DEMO**: simulated chat and **ContextPanel** fixtures. Users interpret «Файлы проекта» / «Рaскадровка» / «Сравнение моделей» as broken product.

## Fix strategy

- **Do not** remove DEMO; label it and route power users to REAL.
- **Do not** fake REAL with static assets.
- **Wire** existing React modules via `CreativeWorkspace` when `REAL` + server `projectId`.
- **Surface** mode switch in header; login handoff for REAL.
- **Replace** assets placeholder with real MinIO-backed library.

## Files touched (UX recovery batch)

| Area | Files |
|------|--------|
| Mode discovery | `studio-mode-switch.tsx`, `studio-header.tsx`, `demo-mode-banner.tsx`, `context-panel.tsx` |
| REAL empty state | `real-studio-empty.tsx`, `studio-shell.tsx` |
| Assets | `project-assets-section.tsx`, `creative-workspace.tsx` |
| Auth handoff | `app/login/page.tsx` |

## Acceptance checklist (product)

See parent task §18. **Not claimed complete** until:

- Live REAL walkthrough on staging with screenshots.
- User-journey E2E green on VPS.
- Phase 3/4 + Phase 5 suite regression analyzed (not masked with API-only approvals).

## Related docs

- `PHASE5-DEMO-REAL-UX-AUDIT.md` — chain and root cause.
- `PHASE5-UI-ACCEPTANCE.md` — update after visual sign-off.
- `PHASE5-PROGRESS.md` — deploy SHAs and E2E table.
