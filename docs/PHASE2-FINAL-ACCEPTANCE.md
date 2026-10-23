# Phase 2 final acceptance (in progress)

**Git:** `fa73adb` (staging integration checkpoint) + uncommitted follow-up (security, queue, tests).  
**Criterion:** LOGIN → PROJECT → CHAT → UPLOAD → DB → APPROVAL → EVENTS → RELOAD → RESTORED — **partially met on staging**.

## Summary matrix

| Area | IMPLEMENTED | TESTED | DEPLOYED (staging) | BLOCKED |
|------|-------------|--------|--------------------|---------|
| Auth (Better Auth) | yes | smoke + partial integration | yes | prod secrets |
| Projects / chat persistence | yes | smoke + integration (isolation) | yes | full browser E2E |
| Upload pipeline | partial (init/complete, MIME, queue) | manual only | yes | multipart, full ffmpeg |
| Approvals API | yes | no | yes | UI REAL blocks need API data |
| ApprovalCard → API | partial (REAL UUID path) | no | web not redeployed | demo blocks unchanged |
| BullMQ worker | partial (metadata job) | no | worker redeploy pending | poster/cleanup queues |
| SSE replay | partial (Last-Event-ID, cursor fix) | no | yes | durable reconnect test |
| Security integration | yes | run with `RUN_INTEGRATION_TESTS=1` | — | CI wiring |
| Production cutover | prepared files | no | **no** | tests + secret rotation |

## Commands (verification)

```bash
pnpm --filter web lint          # 0 errors, warnings documented
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter api typecheck
RUN_INTEGRATION_TESTS=1 INTEGRATION_API_URL=http://127.0.0.1:3021 pnpm --filter api test:integration
E2E_REAL_BACKEND=1 pnpm --filter web exec playwright test e2e/real-auth.spec.ts
```

## Rollback

1. nginx: restore `/etc/nginx/sites-enabled/ai.shotbro.ru.conf.bak-*`.
2. `docker compose -f infra/docker-compose.staging.yml down` (does **not** affect `infra-web-1` / DEMO).
3. Remove `/api/` location → DEMO-only site on 3020.

## Remaining P0 blockers

1. Deploy latest API/worker images to VPS and run integration + Playwright REAL against `https://ai.shotbro.ru`.
2. Enable staging lockdown (basic auth + gate + register off).
3. Complete upload multipart, approval UI refresh, SSE reconnect test with media job.
4. Production secrets + separate prod compose — **do not cut over** until above pass.
