# Phase 2 final acceptance

**Branch:** `phase2/backend`  
**Baseline:** `2dd93b6` → **checkpoints:** `3df617e` (REAL backend bundle) → **`abfa67d`** (S3 presign + E2E fixes)  
**Staging:** https://ai.shotbro.ru (API :3021, web :3020, MinIO :9003, `ALLOW_PUBLIC_REGISTER=false`)

## Summary matrix

| Area | IMPLEMENTED | TESTED | DEPLOYED (staging) | BLOCKED |
|------|-------------|--------|--------------------|---------|
| Auth (Better Auth) | yes | integration + Playwright login | yes | prod cutover |
| Projects / chat / persist | yes | integration + Playwright REAL chain | yes | — |
| Browser S3 upload (presigned) | yes | `staging-upload-smoke.sh` PUT 200; Playwright upload (desktop) | yes (`/shotbro-staging/` nginx) | Selectel prod |
| Assets API | yes | upload integration + smoke | yes | — |
| Approvals API + ApprovalCard UUID | yes | partial manual | API yes | full chat blocks E2E |
| Worker media.metadata/thumbnail/poster | yes | smoke → PROCESSING | yes | long video soak |
| SSE + Last-Event-ID | yes | integration (403 isolation) | yes | media job reconnect E2E |
| `@shotbro/ai` (OpenRouter off) | yes | unit | yes | paid AI Phase 3 |
| Security isolation | yes | integration 10/10 | yes | — |
| SMTP Beget | yes | `pnpm verify:smtp` | staging.env | rotate leaked password |
| Production Selectel / volumes | prepared | MinIO staging only | — | **new keys required** |
| OpenRouter / paid AI | disabled | guards | yes | Phase 3 |

## P0 chain (no paid AI)

| Step | Status |
|------|--------|
| LOGIN | OK — E2E account `e2e-phase2@shotbro.test` (pre-seeded, register locked) |
| PROJECT | OK |
| CHAT → DB | OK — Playwright persist + reload + re-login |
| UPLOAD | OK — presigned `https://ai.shotbro.ru/shotbro-staging/...` (SigV4 origin-only signer) |
| RELOAD / RESTORE | OK — REAL mode + `activeRealProjectId` in localStorage |
| APPROVAL / SSE | API OK; browser E2E not fully automated |

## Verified commands

```bash
# Local / CI
pnpm --filter web build
pnpm --filter api typecheck
pnpm --filter @shotbro/ai test

# VPS
bash scripts/staging-upload-smoke.sh          # PUT 200 + complete
bash scripts/nginx-s3-bucket-proxy.sh         # /shotbro-staging/ → :9003
S3_PUBLIC_ENDPOINT=https://ai.shotbro.ru      # no /minio-storage path in signer

# Integration (enable ALLOW_PUBLIC_REGISTER=true on API briefly)
RUN_INTEGRATION_TESTS=1 INTEGRATION_API_URL=http://127.0.0.1:3001 \
  vitest run --config vitest.integration.config.ts

# Playwright REAL (desktop; use Chrome channel — headless_shell hangs on Windows)
E2E_REAL_BACKEND=1 E2E_STAGING_URL=https://ai.shotbro.ru \
  E2E_TEST_EMAIL=e2e-phase2@shotbro.test E2E_TEST_PASSWORD=*** \
  pnpm exec playwright test e2e/real-auth.spec.ts --project=desktop
```

## Fixes in `abfa67d`

- **S3 403:** `resolveS3SigningEndpoint()` strips path from `S3_PUBLIC_ENDPOINT`; nginx proxies `/{bucket}/` without URI strip.
- **Playwright hang:** `launchOptions.channel: "chrome"`, `waitUntil: "domcontentloaded"`, close settings sheet after REAL, `workers: 1` for staging.
- **Integration:** `signOut()` clears session cookie; upload complete accepts 2xx.

## Production blockers

1. Selectel keys rotated + separate prod DB/volumes/nginx.
2. `EMAIL_VERIFICATION_REQUIRED=true` only after full verify flow; rotate SMTP password if ever exposed.
3. Do **not** enable OpenRouter/paid generations until Phase 3 sign-off.
4. Optional: `STAGING_GATE_SECRET` + `nginx-staging-lockdown.sh` on public `/api/`.

## Rollback

1. nginx: restore `*.bak-*` under `/etc/nginx/sites-enabled/`.
2. `docker compose -f infra/docker-compose.staging.yml down` (does not stop DEMO `infra-web-1` :3020).
3. Remove `/api/` and `/shotbro-staging/` locations for DEMO-only site.
