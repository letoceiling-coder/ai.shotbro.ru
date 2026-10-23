# Phase 2 final acceptance

**Branch:** `phase2/backend`  
**Baseline commit:** `2dd93b6` → **session delta:** AI package, assets/multipart API, REAL UI upload, SMTP, staging MinIO proxy (uncommitted on disk).  
**Criterion:** LOGIN → PROJECT → CHAT → UPLOAD → DB → APPROVAL → EVENTS → RELOAD → RESTORE — **met on staging API**; browser REAL E2E and public upload CORS still need web redeploy + verification.

## Summary matrix

| Area | IMPLEMENTED | TESTED | DEPLOYED (staging) | BLOCKED |
|------|-------------|--------|--------------------|---------|
| Auth (Better Auth) | yes | smoke + integration (isolation) | yes | prod cutover |
| Projects / chat | yes | smoke + integration | yes | Playwright REAL on prod URL |
| Upload (presigned + multipart ≥8MB) | yes | integration PUT (nginx host signature) partial | yes | Selectel prod |
| Assets (list/download/delete/restore/versions) | yes | via upload test | yes | — |
| Approvals API + ApprovalCard UUID | yes | manual | API yes / web partial | REAL approval blocks in chat |
| BullMQ `media.metadata` + sharp thumb | yes | worker on staging | yes | ffprobe/poster |
| SSE + Last-Event-ID | yes | integration (403 stream for B) | yes | long reconnect + media job |
| `@shotbro/ai` registry/orchestrator | yes | unit (3 tests) | API `/api/v1/ai/registry` | OpenRouter off |
| Security isolation | yes | integration (10 cases) | — | — |
| SMTP Beget | yes | `pnpm verify:smtp` OK | staging.env | rotate leaked password |
| Production Selectel | prepared | MinIO staging only | — | **new keys required** |
| OpenRouter / paid AI | disabled | guards + unit | yes | Phase 3 |

## Verified commands

```bash
pnpm --filter web build
pnpm --filter api typecheck
pnpm --filter @shotbro/ai test
pnpm verify:smtp
# On VPS (API container):
RUN_INTEGRATION_TESTS=1 INTEGRATION_API_URL=http://127.0.0.1:3001 \
  ./node_modules/.bin/vitest run --config vitest.integration.config.ts
bash scripts/staging-smoke.sh   # host → 127.0.0.1:3021
```

## Chain status (no paid AI)

| Step | Staging |
|------|---------|
| LOGIN / register | OK (`ALLOW_PUBLIC_REGISTER=true` for tests; set `false` for public lockdown) |
| PROJECT | OK |
| CHAT (persist messages) | OK |
| UPLOAD | API + worker OK; browser needs `/minio-storage/` + presigned host alignment |
| DATABASE | 23 tables, migrate OK |
| APPROVAL | API OK; UI wired for UUID blocks |
| EVENTS / SSE | API OK |
| RELOAD / RESTORE | REAL mode + `activeRealProjectId` persisted in localStorage |

## Rollback

1. nginx: restore `*.bak-*` under `/etc/nginx/sites-enabled/`.
2. `docker compose -f infra/docker-compose.staging.yml down` (does **not** touch `infra-web-1` DEMO :3020).
3. Remove `/api/` and `/minio-storage/` locations to return DEMO-only site.

## Before first real AI generation (Phase 3)

1. Rotate Selectel + OpenRouter keys; set `S3_ENDPOINT` / production compose (separate DB/volumes).
2. Enable OpenRouter only with `OPENROUTER_ALLOW_PAID_REQUESTS=false` until owner approves each paid tool.
3. Redeploy **web** with `NEXT_PUBLIC_API_URL=https://ai.shotbro.ru` (empty = same-origin).
4. Set `ALLOW_PUBLIC_REGISTER=false`, enable `EMAIL_VERIFICATION_REQUIRED=true` when ready.
5. Run Playwright `E2E_REAL_BACKEND=1` against production URL.
6. Optional: nginx basic auth on `/api/` (`scripts/nginx-staging-lockdown.sh`).

## Remaining P0 (non-AI)

- Redeploy **web** image on :3020 with REAL upload + mode persistence.
- Confirm presigned upload from browser (MinIO proxy + CORS).
- Turn `ALLOW_PUBLIC_REGISTER=false` on public staging after E2E.
- Production cutover checklist — **do not switch prod** until above pass.
