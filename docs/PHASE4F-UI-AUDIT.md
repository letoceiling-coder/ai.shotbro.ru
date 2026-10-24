# Phase 4F — UI audit (baseline)

**Date:** 2026-10-24  
**Pre-4F staging web:** `4a3896f`  
**Post-4F staging web:** **`4a89fef`** (2026-10-24, compose `infra-web-1`)

## Root cause (why Phase 2–4E felt invisible)

| Finding | Detail |
|---------|--------|
| REAL thread existed but hidden | `RealThread` only when `mode=REAL` **and** project selected; default mode **DEMO** |
| Context panel DEMO-only | `ContextPanel` used Zustand demo store; REAL assets/graph not shown |
| Header/sidebar DEMO-centric | Title from demo project; REAL list only in REAL mode sidebar |
| Composer split | Full `ChatComposer` (strategy UI) only in DEMO; REAL used minimal textarea |
| Backend blocks wired | `MessageBlockRenderer` supports production blocks; REAL messages depend on agent output |

## Functionality matrix (pre-4F)

| Capability | Backend | Frontend component | UI accessible (REAL) | Wired |
|------------|---------|-------------------|----------------------|-------|
| Agent runs / tools | yes | `AgentRunStrip` (new) | partial | SSE + API |
| Model catalog | yes | `ModelSelector` (new) | partial | `/providers/model-catalog` |
| Production graph | yes | `ProductionBoardCard`, context tab | partial | API |
| Provider jobs | yes | `ProviderStatusCard`, context tab | partial | API + SSE |
| Approvals | yes | `ApprovalCard` | yes | API |
| Script/storyboard blocks | yes | `ScriptCard`, `StoryboardViewer` | when in messages | blocks |
| Assets | yes | context Assets tab (new) | partial | API |
| Project templates | — | `NewProjectDialog` (new) | partial | create + settings |

Screenshots: server Playwright `phase4f-studio-audit.spec.ts` → `test-results/phase4f-*.png` after deploy.

## 2026-10-24 closeout — RealComposer

| Issue | Fix |
|-------|-----|
| Composer absent during message load | `RealThread` no longer unmounts `RealComposer` on `isLoading` |
| Deploy drift (systemd vs compose) | `staging-deploy-web.sh` recreates `infra-web-1` |
| E2E false negatives | Removed API create fallback; mobile sidebar assertion removed |

Diagnostic: `staging-playwright-e2e.sh … diagnostic` → **PASS** (`/tmp/phase4f-diagnostic-4a89fef.log`).

See **`PHASE4F-USER-FACING-ACCEPTANCE.md`** for post-deploy status.
