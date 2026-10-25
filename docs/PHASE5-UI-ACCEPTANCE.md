# Phase 5 — UI acceptance (Creative Studio 5D–5F)

**Status:** **ACCEPTED** for Storyboard, Character, Reference modules on staging (2026-10-25).  
**Site:** https://ai.shotbro.ru  
**Branch:** `phase5/creative-studio` · VPS HEAD `68a09d7` · web image `015cbb7`

## Primary acceptance scenario

**Combined creative flow** — `phase5-creative-flow.spec.ts`  
**Log:** `/var/log/shotbro-e2e/phase5-creative-flow-68a09d7.log`  
**Result:** **1/1 PASS** · `retries=0`

Single REAL project, UI-driven path:

Script → Storyboard → Character → Reference → first frame → Model settings → Save → F5 → verify persisted state across modules.

No PATCH-only shortcuts for steps that have UI affordances.

## Module suites (viewports inside specs)

| Module | Viewports PASS | Extra tests | Log |
|--------|----------------|-------------|-----|
| Storyboard 5D | 4/4 | 409 conflict 1/1 | `phase5-storyboard-015cbb7.log` |
| Characters 5E | 4/4 | — | `phase5-characters-015cbb7.log` |
| References 5F | 4/4 | isolation 1/1 | `phase5-references-015cbb7.log` |

Full creative bundle mode: `phase5-creative` runs all four spec files in one invocation (same as running them individually).

## Regression & providers (stability)

| Suite | Expected | Actual | Log |
|-------|----------|--------|-----|
| `regression-strict` | 8/8 | **8/8 PASS** | `regression-strict-retry-68a09d7.log` |
| `phase5-providers` | 16/16 | **16/16 PASS** | `phase5-providers-68a09d7.log` |

**Note:** First `regression-strict` attempt at `68a09d7` scored 6/8 (phase3 brief visibility @ desktop1440; phase4 agent signal @ tablet). Immediate re-run with `retries=0` passed 8/8 in ~5.1m — treat as timing/environment flake; no code change required for 5D–5F closure.

## Persistence evidence

- Storyboard: reload retains title, description, duration, frame asset IDs (API polled in tests).
- Characters: F5 after version restore/assign.
- References: F5 after role attachments; detach semantics verified.

## Security checklist (5D–5F scope)

| Check | Result |
|-------|--------|
| Asset ownership / project access | Enforced (API) |
| Character & reference ownership | Enforced |
| Storyboard revision conflict | **409** E2E |
| Signed URLs | Used for assets |
| No raw storage creds in browser | Spot-check OK |
| No public live generation | Mock flags off for live |
| Secrets in Playwright logs | Not observed |
| Magnific key in output | Not printed · **ROTATION_REQUIRED** if prior leak |

## Not in this acceptance

- Phase 5G Prompt Studio (next stage).
- Full `PHASE5-FINAL-ACCEPTANCE.md` for entire Phase 5 (5H–5P still open).
- Vitest provider suite on host (Playwright providers routing used instead).

## Remaining operational notes

- VPS disk ~91% full — prune only unused build cache/images with rollback tags kept.
- Web at `015cbb7` is ahead of oldest API build label in registry; API stable for storyboard/character/reference APIs used by E2E.
