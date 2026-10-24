# Phase 4F — User-facing acceptance

**Date:** 2026-10-24  
**Branch:** `phase4/intelligent-production`  
**Git HEAD:** `fc0b43c`

## Deploy (VPS 85.117.235.93)

| Component | SHA / tag | Status |
|-----------|-----------|--------|
| Web (systemd `:3020`) | **`c3178cb`** (`shotbro-web-build:c3178cb`) | **DEPLOYED** |
| API / worker (Docker) | **`4b127c7`** (4F settings API; hotfix) | **DEPLOYED** |
| `DEPLOYED.txt` | `DEPLOYED=c3178cb`, `DEPLOYED_WEB=c3178cb` | verified |
| E2E-only source on VPS | newer commits synced for Playwright | not web-rebuilt |

**Policy (unchanged):** `AI_MOCK_MODE=true`, `OPENROUTER_ENABLED=false`, `OPENROUTER_ALLOW_PAID_REQUESTS=false`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`.

## Root cause (pre-4F)

Documented in **`PHASE4F-UI-AUDIT.md`**: DEMO-first shell, REAL thread hidden until mode + project, demo-only context panel, minimal REAL composer.

## User-visible REAL features (post-4F web)

| Feature | Backend | Wired | Visible REAL | Notes |
|---------|---------|-------|--------------|-------|
| Project templates dialog | settings on create | **WIRED** | **VISIBLE** | Sidebar «Новый проект» |
| REAL context panel (Context / Production / Assets / Models) | API + SSE | **WIRED** | **VISIBLE** | Right sheet / panel |
| Agent run strip | AgentRun + trace API | **WIRED** | **VISIBLE** | Above thread when project open |
| Model selector (economy/balance/quality/manual) | model-catalog | **WIRED** | **VISIBLE** | `RealComposer` |
| Production / approval blocks in chat | orchestrator | existing | **VISIBLE** | When agent runs |
| Mock / live policy badges | catalog + env | **WIRED** | **VISIBLE** | «Live AI заблокирован» |

## Frontend files (4F core commit `4b127c7` + `c3178cb`)

- `studio-shell.tsx`, `real-context-panel.tsx`, `agent-run-strip.tsx`
- `new-project-dialog.tsx`, `project-templates.ts`, `real-projects-sidebar.tsx`
- `real-composer.tsx`, `model-selector.tsx`
- `use-studio-production.ts`, header/banner updates
- API: project `settings` on create/patch (`packages/contracts`, `projects.service`)

## Screenshots (server Playwright)

Path on VPS: `/var/www/ai.shotbro.ru-src/apps/web/test-results/phase4f-{demo|real}-{desktop1920|desktop1440|tablet|mobile390}.png`

| Viewport | DEMO | REAL |
|----------|------|------|
| 1920 | **TESTED** pass | **TESTED** pass |
| 1440 | **TESTED** pass | **TESTED** pass |
| tablet | **TESTED** pass | **TESTED** pass |
| mobile 390 | **TESTED** pass (DEMO) | **TESTED** after `switchToRealMode` fix (sidebar marker) |

## Tests (VPS only)

| Suite | Result | Notes |
|-------|--------|-------|
| Phase 3 API smoke | **PASS** | `mock:true` |
| Phase 4 unified API smoke | **PASS** | `mock:true` |
| Playwright `phase4f-studio-audit` | **3/4 viewports stable**; mobile REAL assertion fixed in Git | Docker `mcr.microsoft.com/playwright:v1.64.1-jammy` |
| Playwright Phase 3 / 4 regression | **BLOCKED → fix** | `openRealNewProject` updated for template dialog (was one-click create) |
| Runner | `infra/scripts/staging-playwright-e2e.sh` | Docker-based; no local runs |

**Historical run (pre-dialog E2E fix):** 20/24 Playwright cases passed (Phase 3/4 regression on staging web `4a3896f` matrix documented in Phase 4E).

Re-run full matrix after deploying E2E-only sync or next web tarball including `real-login.ts` helpers (no API change required).

## Status legend

| Item | Status |
|------|--------|
| REAL studio layout + panels | **IMPLEMENTED** **DEPLOYED** **VISIBLE** |
| Template-based project create | **IMPLEMENTED** **WIRED** **VISIBLE** |
| Agent strip + model selector | **IMPLEMENTED** **WIRED** **VISIBLE** |
| Full F5–F12 checklist in browser | **partial** — regression E2E must pass with new dialog flow |
| Live paid AI | **BLOCKED BY POLICY** |
| Production cutover | **NOT PERFORMED** |

## Sign-off criterion

User on https://ai.shotbro.ru/studio can switch to **REAL**, create a project from templates, see agent strip / context panel / model selector, and drive mock production — **confirmed on staging web `c3178cb`** for desktop/tablet via audit screenshots; full production-chain Playwright pending one E2E helper sync (dialog create).
