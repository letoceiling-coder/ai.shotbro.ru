# Phase 5 — Progress

**Branch:** `phase5/creative-studio`  
**Remote repo HEAD (VPS):** `00ea52e`  
**Acceptance date:** 2026-10-25 (5G gate)  

## Deployed staging (https://ai.shotbro.ru)

| Service | Build / image | Notes |
|---------|----------------|--------|
| Web | `shotbro/web:current` · build **`13891f9`** | Prompt Studio tab |
| API | `shotbro/api:current` · build **`f180fa0`** | Prompt REST + agent delegates |
| Worker | `ai-shotbro-staging-worker:latest` | Up with API |
| E2E runner scripts | `68a09d7` | Playwright specs + `staging-playwright-e2e.sh` modes |

**Policy (verified on API container, values redacted):** `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `OPENROUTER_ENABLED=false`, `OPENROUTER_ALLOW_PAID_REQUESTS=false`. Per-provider live switches off. **Live AI calls: 0.** No production cutover.

**VPS disk:** `/dev/vda1` ~11G free (~91% used) — monitor before large image builds; rollback tags retained (`ed85a6a`, `3240e70`, `015cbb7`, …).

## Stage status

| Stage | Scope | Status |
|-------|--------|--------|
| 5A | Product audit + baseline screenshots | **IMPLEMENTED** |
| 5B | Creative workspace shell + section nav | **DEPLOYED** |
| 5C | Script editor + API CRUD | **DEPLOYED** |
| 5D | Storyboard studio | **ACCEPTED** — see `PHASE5-STORYBOARD-ACCEPTANCE.md` |
| 5E | Character studio | **ACCEPTED** — see `PHASE5-CHARACTER-CONSISTENCY.md` |
| 5F | Reference manager | **ACCEPTED** — see `PHASE5-REFERENCE-MANAGER.md` |
| 5MP | Multi-provider (mock) | **DEPLOYED** — Providers E2E 16/16 |
| 5G | Prompt studio | **ACCEPTED** (E2E 4/4) — see `PHASE5-PROMPT-STUDIO-ACCEPTANCE.md` |
| 5I | Timeline + FFmpeg from timeline JSON | **IMPLEMENTED** (VPS acceptance pending) |
| 5H, 5J–5P | Remaining Phase 5 scope | NOT IMPLEMENTED |

## Playwright on VPS (`retries=0`, logs under `/var/log/shotbro-e2e/`)

| Mode | Result | Log |
|------|--------|-----|
| `phase5-storyboard` | **5/5 PASS** (4 viewports + 409 conflict) | `phase5-storyboard-015cbb7.log` |
| `phase5-characters` | **4/4 PASS** | `phase5-characters-015cbb7.log` |
| `phase5-references` | **5/5 PASS** (4 viewports + cross-project isolation) | `phase5-references-015cbb7.log` |
| `phase5-creative-flow` | **1/1 PASS** | `phase5-creative-flow-68a09d7.log` |
| `regression-strict` | **8/8 PASS** (second run; first run 6/8 — timing flakes phase3 desktop1440, phase4 tablet) | `regression-strict-retry-68a09d7.log` |
| `phase5-providers` | **16/16 PASS** | `phase5-providers-68a09d7.log` |
| `phase5-prompts` | **4/4 PASS** (1920, 1440, tablet, mobile390) | `phase5-prompts-00ea52e-r2.log` |
| `regression-strict` (post-5G) | **7/8** (phase4 unified MP4 failed once) | `regression-strict-00ea52e.log` |

Runner modes `phase5-storyboard`, `phase5-characters`, `phase5-references`, `phase5-creative-flow`, `phase5-creative`, `regression-strict`, `phase5-providers` map to the spec files in `infra/scripts/staging-playwright-e2e.sh`. Creative specs use `--project=desktop` only; viewports are set inside tests (1920, 1440, tablet, mobile390).

Screenshots/traces: `apps/web/test-results/` on the VPS E2E working tree (e.g. `phase5-storyboard-grid-*.png`, `phase5-creative-flow-final.png`).

## Phase 5D–5F DONE criteria

| Criterion | Status |
|-----------|--------|
| Storyboard 4/4 viewports | **PASS** |
| Characters 4/4 | **PASS** |
| References 4/4 | **PASS** |
| Combined creative flow | **PASS** |
| Phase 3/4 strict 8/8 | **PASS** (documented retry) |
| Providers 16/16 | **PASS** |
| F5 persistence | **PASS** (covered in specs) |
| Live AI off | **PASS** |

## Security (5D–5F smoke)

- Asset/project/character/reference access enforced server-side (AccessPolicyService patterns).
- Storyboard PATCH uses revision checks (409 covered in E2E).
- Signed URLs for assets; no raw MinIO credentials in browser bundle (spot-check during acceptance).
- **ROTATION_REQUIRED** for Magnific keys if ever exposed in chat — keys present in `staging.env` only; not printed in logs.

## Docs

- `PHASE5-STORYBOARD-ACCEPTANCE.md`
- `PHASE5-CHARACTER-CONSISTENCY.md`
- `PHASE5-REFERENCE-MANAGER.md`
- `PHASE5-UI-ACCEPTANCE.md`
- `PHASE5-MULTIPROVIDER-ACCEPTANCE.md` (providers suite)

## Next

1. VPS: deploy web+api, run `phase5-prompts` + regression suites (`retries=0`).  
2. Close `PHASE5-PROMPT-STUDIO-ACCEPTANCE.md` Table B.  
3. **Phase 5I Timeline** — versioned montage JSON + FFmpeg sync (see `PHASE5-REMAINING-WORK.md`).
