# Phase 2 security report

Date: 2026-10-23  
Scope: staging API (`ai-shotbro-staging`), integration suite `apps/api/test/integration/security-isolation.integration.spec.ts`

## Controls implemented

| Control | Status |
|---------|--------|
| Better Auth session cookies | IMPLEMENTED |
| SessionGuard on `/api/v1/*` (except health) | IMPLEMENTED |
| Workspace/project access policy | IMPLEMENTED |
| `ALLOW_PUBLIC_REGISTER` gate | IMPLEMENTED (default false) |
| Optional `STAGING_GATE_SECRET` + `X-Shotbro-Staging-Gate` | IMPLEMENTED |
| nginx basic auth script for `/api/` | IMPLEMENTED (`scripts/nginx-staging-lockdown.sh`) |
| Global rate limit (120 req/min) | IMPLEMENTED (ThrottlerGuard) |
| Upload MIME allowlist + magic-byte sniff | IMPLEMENTED |
| CORS restricted to `TRUSTED_ORIGINS` | IMPLEMENTED |
| OpenRouter boot guard | IMPLEMENTED |

## Integration tests (requires `RUN_INTEGRATION_TESTS=1`)

Run against live API (see `scripts/run-integration-tests.sh`):

- User A / User B isolation (projects, messages, SSE).
- Unauthenticated `/users/me` → 401.
- Logout → session invalid.

Not yet automated in CI: upload session IDOR, approval IDOR, CSRF token double-submit (cookie SameSite), SQLi fuzzing.

## Staging exposure

- Public URL `https://ai.shotbro.ru/api/` proxies to staging port **3021**.
- **Recommendation:** enable `nginx-staging-lockdown.sh` + set `STAGING_GATE_SECRET` on API + `ALLOW_PUBLIC_REGISTER=false`.
- Direct port **3021** must remain bound to `127.0.0.1` only (verified in compose).

## Findings / fixes this session

1. **Nest DI under tsx** — missing `design:paramtypes`; fixed with explicit `@Inject()` (prevents auth bypass via broken guards).
2. **Public staging API** — mitigated via gate header + nginx basic auth tooling; production cutover still blocked.

## Blocked

- Production Selectel keys (compromised; MinIO staging only).
- SMTP / email verification.
- Full OWASP matrix automation.
