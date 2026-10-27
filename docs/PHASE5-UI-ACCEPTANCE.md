# Phase 5 — UI acceptance

**Status:** **ACCEPTED** (modules 5D–5F, 2026-10-25) · **P0 REAL Creative Workspace ACCEPTED** (2026-10-27)  
**Site:** https://ai.shotbro.ru/studio  
**Branch:** `phase5/creative-studio`  
**Git HEAD:** `3eb89d3` · **Runtime web:** `3eb89d3` / **API·worker:** `6aaab0a`

## P0 REAL user journey (2026-10-27)

| Check | Evidence |
|-------|----------|
| REAL mode + project + Agent Chat | `phase5-user-journey-b68527c.log` |
| UI-only approvals (`approval-action-approve`) | Same |
| Storyboard Sync + re-approval after edit | Same + `PHASE5-APPROVAL-REVISION-INTEGRITY.md` |
| Reference attach + F5 | Journey spec |
| Timeline reorder UI + save | Journey spec |
| Production section + mock MP4 + F5 | Journey spec |
| Viewports | 1× full desktop1920 + 3× nav smoke |

## Approval UX (revision integrity)

- Stale chat cards: **EXPIRED** from API → badge «Устарело», buttons disabled, hint to use newer card below.
- Active **PENDING** card matches current document version (orchestrator `requestApproval`).
- Version mismatch on click → «Нужны правки» (409), no silent approve.
- Idempotent **Sync script** without document change → no extra PENDING (`revised: false`).

## Module suites (Playwright, `retries=0`)

| Module | Result | Log |
|--------|--------|-----|
| Storyboard 5D | **5/5** | `phase5-storyboard-6aaab0a.log` |
| Characters 5E | **PASS** | `phase5i-signoff-suites.log` |
| References 5F | **PASS** | same |
| Creative flow | **PASS** | same |
| Prompts | **PASS** | same |
| Providers | **PASS** | same |
| Timeline | **PASS** | same |
| Assembly | **1/1** | same |

## Regression

| Suite | Result | Log |
|-------|--------|-----|
| `regression-strict` | **8/8 PASS** | `regression-strict-6aaab0a.log` |

Prior `phase5i-regression-r4.log` failures (**PRODUCING** timeout) resolved by timeline ensure + worker **FAILED** handling — not UI regression.

## Mock policy

Staging verified mock-only; no live OpenRouter/Fal/Magnific/ElevenLabs spend in acceptance runs.
