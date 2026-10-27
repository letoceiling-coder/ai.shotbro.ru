# Phase 5 — User Interface Recovery (P0)

**Status:** **ACCEPTED** (P0 UI Recovery, 2026-10-27)

## Staging runtime (2026-10-27)

| Service | SHA |
|---------|-----|
| Web | `853ccda` |
| API | `61234da` |
| Worker | `af5315f` |

## User journey runs (`/var/log/shotbro-e2e/`)

| Log | Result | First FAIL / notes |
|-----|--------|-------------------|
| `phase5-user-journey.log` | 4 failed, 12 skipped | `PRODUCING` 600s (empty timeline `clipCount: 0`) — pre-`61234da` |
| `phase5-user-journey-r2.log` | 1 failed, 3 skipped | `storyboard-sync` click on **Timeline** tab (wrong testid) — fixed in `user-journey-ui.ts` |
| `phase5-user-journey-r3.log` | 1 failed, 3 skipped | `waitForProductionEnqueued` treated `WAITING_STORYBOARD_APPROVAL` as success → 600s wait |
| `phase5-user-journey-r4.log` | 1 failed, 3 skipped | Storyboard gate stuck after **Sync script** (`storyboard-sync`) bumps doc version vs approval card |
| `phase5-user-journey-r5.log` | **4/4 PASS** (~5.5m) | Desktop full UI path + 3 viewport smokes; fixes: timeline sync testid, no pre-approve storyboard sync, `latestAgentRun` + production gate helper |

**UI path verified before last failures:** REAL → project → chat → PLAN/SCRIPT approvals → storyboard tab → (optional sync **removed**) → references attach + F5 → timeline sync/reorder UI → chat production gates.

**Viewport:** Playwright `--project=desktop` only — 1× full desktop1920 + 3× nav smoke (1440 / tablet / mobile390). Not four full production runs.

**Sign-off:** `phase5i-signoff-suites.log` **ALL_PASS** · `regression-strict-6aaab0a.log` **8/8** · journey **b68527c** **4/4** · storyboard approval fix **6aaab0a** · approval UX **a2395a9**.

## User journey run (2026-10-26, log `phase5-user-journey.log`)

| Item | Result |
|------|--------|
| Playwright running now | **No** (finished) |
| Exit | **4 failed**, 12 skipped (serial bail-out) |
| First FAIL | `waitForProductionCompleted` — run stuck **`PRODUCING`** (600s) |
| Passed steps (inferred) | REAL project, chat, partial UI approvals, creative tab visits |
| Traces | `test-results/phase5-user-journey-*-desktop/trace.zip` (×4 playwright projects) |

**Root cause:** Worker logged `timeline_assembly_start` with **`clipCount: 0`** (empty v2 timeline from `ensureTimeline`) → assembly error → run never reaches `COMPLETED`. Fix: `ensureTimelineForProduction` syncs storyboard before enqueue; E2E syncs timeline via UI before final approvals.

**Viewport coverage:** Prior run incorrectly executed the same test on 4 Playwright **projects** (16 tests). Updated: **one full journey on desktop1920** + **smoke nav** on 1440/tablet/mobile390; Playwright mode `--project=desktop` only.  
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
| Production tab | `production-section.tsx` (graph, jobs, trace, MP4 link) |
| UI-only E2E approvals | `e2e/helpers/ui-approvals.ts`, `approval-action-approve` testid |
| Full journey spec | `e2e/phase5-user-journey.spec.ts`, mode `phase5-user-journey` |

## Acceptance checklist (product)

See parent task §18. **Not claimed complete** until:

- Live REAL walkthrough on staging with screenshots.
- User-journey E2E green on VPS.
- Phase 3/4 + Phase 5 suite regression analyzed (not masked with API-only approvals).

## Related docs

- `PHASE5-DEMO-REAL-UX-AUDIT.md` — chain and root cause.
- `PHASE5-UI-ACCEPTANCE.md` — update after visual sign-off.
- `PHASE5-PROGRESS.md` — deploy SHAs and E2E table.
