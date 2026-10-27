# Phase 5J — Asset Library acceptance

**Status:** **NOT ACCEPTED** (stabilization in progress)  
**Git (target):** `cc5abbf` · **VPS pulled:** `b076f47` → pending `cc5abbf`  
**Branch:** `phase5/creative-studio`

## Deployment

| Service | Image label | Notes |
|---------|-------------|--------|
| Web | `HEAD` (literal) | Source matches **`57f1579`/`b076f47`**; fixed in `b076f47` → resolves to short SHA |
| API | `HEAD` (literal) | Same |
| Worker | **`366716e`** | Unchanged; upload processing OK |

**Prior mistake:** `staging-deploy.sh … HEAD` passed literal `HEAD` to Docker `BUILD_SHA`. **Fix:** `shotbro_resolve_deploy_sha` + `staging-deploy-sha-smoke.sh` (`deploy_sha_smoke_ok`).

**Disk (VPS):** ~**31 GB** free (~74% used). **No active `docker build`** after cleanup window (stale wait loops only).

## E2E — critical RCA

| Log | What ran | Result |
|-----|----------|--------|
| `phase5-asset-library-57f1579.log` | **Wrong suite** — missing `phase5-asset-library` mode → default **phase4f + regression** | phase4f mobile390 FAIL; regression **8/8 PASS** |
| `phase5-asset-library-b076f47.log` | Correct spec, but **4 Playwright projects × serial** → 20 runs; desktop1920 **2m timeout** waiting for card after upload | **FAIL** (in progress / failed) |

**Fixes (`b076f47`, `cc5abbf`):**

- Playwright mode `phase5-asset-library` → `e2e/phase5-asset-library.spec.ts`
- Export `E2E_TEST_EMAIL_B` / `INTEGRATION_USER_B_*` for IDOR
- **Desktop-only** project for asset-library (viewport smokes still inside spec)
- Poll **`READY`** via paginated API before UI card assert (180s)

**Re-run log (pending):** `/var/log/shotbro-e2e/phase5-asset-library-cc5abbf.log`

## Viewport / IDOR coverage (intended)

| Viewport | Coverage |
|----------|----------|
| desktop1920 | Full media journey (upload, search, filter, detail, STYLE/first/last, timeline pre-fill+save, F5) |
| desktop1440 / tablet / mobile390 | Library visible + screenshot smoke |
| IDOR | User B denied `download-url` (requires B creds in `staging.env`) |

## Lineage

- `asset_relation` populated on **mock provider ingest** when `toolInput` carries parent asset ids (`generated_from`).
- Upload / storyboard frame assign: **no new asset row** → no relation edge (documented).
- UI: missing edges → «Источник неизвестен».

## Regression bundle

Script: `infra/scripts/staging-phase5j-acceptance.sh` — runs asset-library first, then strict + Phase 5 suites (**incl. characters, creative-flow**).

**Do not start** until `phase5-asset-library` **PASS** and no concurrent Playwright.

## Remaining blockers

1. Green **`phase5-asset-library`** on VPS (`cc5abbf`).
2. Full **`phase5j-acceptance.log`** PASS.
3. Optional: redeploy only if needed for label `b076f47`/`cc5abbf` (content already on HEAD images from git checkout at build time).

## Formal acceptance

**Phase 5J = ACCEPTED** — **no** until items above are green.
