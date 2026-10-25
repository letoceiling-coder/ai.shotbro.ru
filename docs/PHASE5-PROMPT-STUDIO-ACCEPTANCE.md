# Phase 5G — Prompt Studio acceptance

**Scope:** Structured image/video prompts per scene, version history, model validation, agent tool parity, Creative Workspace tab.

**Branch:** `phase5/creative-studio`  
**Git HEAD (acceptance):** `00ea52e`  
**Policy:** `AI_MOCK_MODE=true`, all live provider switches **off**.

## Implementation checklist (code)

| Item | Location |
|------|----------|
| Bundle schema | `packages/contracts/src/production/prompt-schemas.ts` |
| Service | `apps/api/src/production/prompt-version.service.ts` |
| REST | `GET/POST .../prompts`, `latest`, `versions/:v`, `compare`, `restore`, `validate` |
| UI | `apps/web/src/components/creative/sections/prompt-studio.tsx` |
| Nav | `creative-section-nav` → **Prompts** |
| Storyboard link | `storyboard-open-prompts` |
| Agent tools | `packages/ai/.../phase5-prompt-tools.ts` + `agent-tool-delegates.ts` |
| E2E | `apps/web/e2e/phase5-prompt-studio.spec.ts` |
| Runner mode | `staging-playwright-e2e.sh` → `phase5-prompts` |

## VPS verification (fill on run)

| Step | Command / action | Result | SHA / log |
|------|------------------|--------|-----------|
| Disk | `df -h /` | ~44 GiB free (~62% used) | 2026-10-25 |
| Git | `git log -1 --oneline` | `00ea52e` | VPS src |
| Deploy | web `13891f9`, api `f180fa0` | **OK** `shotbro/web:current`, `shotbro/api:current` | |
| Typecheck | API in Docker build | **PASS** | api image build |
| E2E 5G | `phase5-prompts` | **4/4 PASS** | `/var/log/shotbro-e2e/phase5-prompts-00ea52e-r2.log` |
| Regression | `regression-strict` | **7/8** (phase4 unified MP4 flake) | `/var/log/shotbro-e2e/regression-strict-00ea52e.log` |
| Providers/creative | not re-run this gate | prior **16/16**, **5D–5F** accepted | see `PHASE5-PROGRESS.md` |

## E2E scenario (UI, no API shortcuts for saves)

1. Create REAL project + script scene.  
2. Open **Prompts** tab.  
3. Edit image prompt → **Save new version**.  
4. Edit video prompt → second version.  
5. Select v1 → **Restore** → new version with `restoredFromVersion`.  
6. Change image model → **Validate model params**.  
7. Reload (F5) → latest prompt text persisted.  
8. Viewports: 1920, 1440, tablet, mobile390.

## Table B — Phase 5G gates

| Gate | Status | Notes |
|------|--------|-------|
| Implemented | **YES** | `00ea52e` |
| Wired (API ↔ UI ↔ agent) | **YES** | delegates + routes |
| Persisted | **YES** | `prompt_version.parameters.scenePromptBundle` |
| Visible | **YES** | Prompts tab + storyboard link |
| Tested | **YES** | 5G E2E 4/4 viewports |
| Deployed | **YES** | https://ai.shotbro.ru |
| Blockers | regression 7/8 | phase4 unified MP4 — retry recommended |

## Regression policy

Preserve: Phase 3/4 strict 8/8, providers 16/16, storyboard/characters/references/creative-flow. Document flakes with `retries=0` only.
