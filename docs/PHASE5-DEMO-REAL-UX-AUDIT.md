# Phase 5 — DEMO vs REAL UX Audit

**Date:** 2026-10-26 (UTC)  
**Site:** https://ai.shotbro.ru/studio  
**Branch:** `phase5/creative-studio`  
**VPS git (audit start):** `cd54b1f` (API TIMELINE fix); web deploy pending UX recovery commit.

## Executive summary

Users opening `/studio` without switching mode see **DEMO by design**: local Zustand projects, simulated chat (`DemoThread` + `ChatComposer`), and **sheet-based `ContextPanel`** with hard-coded fixtures (`reference.jpg`, `script.md`, `DEMO_ASSETS` storyboard tiles). This matches user screenshots for «Файлы проекта», «Раскадровка», «Сравнение моделей».

**REAL** (PostgreSQL projects, `RealThread`, `CreativeWorkspace`, `RealContextPanel`) is implemented but was **discoverable only via sidebar → Настройки → REAL**. Default mode: `localStorage` key `shotbro-studio-mode-v1` → **`DEMO`**.

## Mode storage

| Key | Location | Values |
|-----|----------|--------|
| `shotbro-studio-mode-v1` | `localStorage` | `DEMO` (default) \| `REAL` |
| `shotbro-studio-demo-v1` | `localStorage` (Zustand persist) | demo projects, `activeRealProjectId`, `creativeSection` |

F5: DEMO data persists locally; REAL mode persists if user previously selected REAL.

## UI routing matrix

| Condition | Main center | Right panel | Section nav |
|-----------|-------------|-------------|-------------|
| DEMO | `DemoThread` + demo composer | `ContextPanel` (demo sheets) | Hidden |
| REAL, no auth | `RealStudioEmpty` → login CTA | None | Hidden |
| REAL, auth, no project | `RealStudioEmpty` + create | None | Hidden |
| REAL + `activeRealProjectId` | `CreativeWorkspace` | `RealContextPanel` | `CreativeSectionNav` |

## User journey map (intended REAL)

| Step | URL | Component | API (typical) | Failure before fix |
|------|-----|-----------|---------------|-------------------|
| Open studio | `/studio` | `StudioShell` | — | Lands in DEMO |
| Login | `/login` | login page | auth | No `mode=real` handoff |
| Select REAL | `/studio` | `StudioModeSwitch` | — | Buried in settings |
| Create project | `/studio` | `NewProjectDialog` | `POST /api/v1/projects` | Sidebar only in REAL |
| Chat | `/studio` (section chat) | `RealThread` | conversations, agent runs | Not mounted in DEMO |
| Script | section `script` | `ScriptEditor` | production documents | Same |
| Storyboard | `storyboard` | `StoryboardStudio` | storyboard API | Demo panel showed fixtures |
| Characters | `characters` | `CharacterStudio` | characters API | — |
| References | `references` | `ReferenceManager` | references + assets | — |
| Prompts | `prompts` | `PromptStudio` | prompts API | — |
| Models | `models` | `ModelSettingsSection` | catalog + project settings | Demo «Сравнение моделей» sheet |
| Timeline | `timeline` | `TimelineStudio` | timeline v2 API | — |
| Assets | `assets` | `ProjectAssetsSection` (recovery) | `GET/POST` assets | Was Phase 5J placeholder |

## Live UI reproduction (2026-10-26)

Playwright/browser on production URL (unauthenticated):

- Header showed **DEMO** flow: pre-filled ad demo chat, «Оценка стоимости (DEMO)».
- **Панели → Файлы проекта:** `reference.jpg`, `script.md` (static list).
- **Панели → Раскадровка:** three colored placeholder images from `DEMO_ASSETS`.
- **Панели → Сравнение моделей:** text stub referencing chat cards.

No console audit on authenticated REAL path in this session (follow-up after web deploy).

## Root causes (product)

1. **Default DEMO** for all first visits.
2. **REAL toggle not visible** in primary chrome (only settings sheet).
3. **Demo context panels** look like product features, not labeled sandbox.
4. **`CreativeWorkspace` gated** on `mode === REAL && activeRealProjectId` — correct, but users never reach it.
5. **Assets tab** was a placeholder while API/MinIO upload already exists elsewhere.

## UX recovery changes (this pass)

- Header **`StudioModeSwitch`** (DEMO / REAL); REAL without session → `/login?return=/studio&mode=real`.
- **Demo banner + demo context panel** explicit copy + «Перейти в REAL».
- **`RealStudioEmpty`** for REAL without selected project (login / create).
- **`ProjectAssetsSection`** wired to AssetService upload/list.
- Login honors `mode=real` query → sets REAL in `localStorage`.

## Not done / remaining

- Full user-journey Playwright (§14 spec) — scaffold pending.
- UI approvals-only regression after UX deploy.
- Post-login optional «remember REAL» without forcing legacy DEMO users.
- `Production` section still placeholder; graph in right panel + chat.
- Runtime SHA table after web image promote.

## How to open REAL (after deploy)

1. Open https://ai.shotbro.ru/studio  
2. Click **REAL** in the header (or banner «Открыть REAL-студию»).  
3. **Register / Login** if prompted.  
4. **Создать проект** in the left sidebar (REAL list).  
5. Use top **Creative Workspace** tabs (Chat, Script, Storyboard, …).  
6. Project files: **Assets** tab or right panel **Assets** tab.

DEMO remains available via **DEMO** toggle for local scenario demos.
