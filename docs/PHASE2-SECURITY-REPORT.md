# Phase 2 security report (Release Candidate)

Date: 2026-10-23  
Scope: staging API (`ai-shotbro-staging`), integration suite under `apps/api/test/integration/`

## Controls

| Control | IMPLEMENTED | TESTED | DEPLOYED |
|---------|-------------|--------|----------|
| Better Auth session cookies | ✓ | ✓ | ✓ |
| SessionGuard on `/api/v1/*` | ✓ | ✓ | ✓ |
| Workspace / project access policy | ✓ | ✓ | ✓ |
| `ALLOW_PUBLIC_REGISTER=false` (RC) | ✓ | ✓ | ✓ |
| Global rate limit (120/min) | ✓ | partial (429 on burst signup) | ✓ |
| Upload MIME allowlist + sniff | ✓ | ✓ | ✓ (+ PDF `%PDF-`) |
| CORS `TRUSTED_ORIGINS` | ✓ | — | ✓ |
| OpenRouter disabled | ✓ | — | ✓ |
| Optional staging gate header | ✓ | manual | optional |
| Idempotency (messages, approvals) | ✓ | ✓ approval | ✓ |

## Integration tests (RC)

Requires `RUN_INTEGRATION_TESTS=1` and live API. For signup-based suites, temporarily set `ALLOW_PUBLIC_REGISTER=true` on staging during a **single sequential** run (`fileParallelism: false`).

| File | Coverage | RC status |
|------|----------|-----------|
| `security-isolation.integration.spec.ts` | cross-user projects, messages, SSE 403, logout, 401 | **10/10 passed** |
| `approval-flow.integration.spec.ts` | approve, 409, reject, revision, idempotency | **4/4 passed** |
| `approval-cross-tenant.integration.spec.ts` | foreign approve ≥403 | **1/1 passed** |
| `upload-idor.integration.spec.ts` | complete, assets list, download URL | **3/3 passed** |
| `upload-flow.integration.spec.ts` | presign PUT complete | **1/1 passed** |
| `sse-replay.integration.spec.ts` | Last-Event-ID, no duplicate event id | **1/1 passed** |

**Skipped tests count as failure for RC sign-off** — none skipped in successful maintenance run.

## Gaps (non-blocking for RC)

| Item | Status |
|------|--------|
| Automated CSRF fuzz | NOT IMPLEMENTED |
| Dedicated rate-limit assertion test | NOT IMPLEMENTED |
| OWASP ZAP / external scan | NOT RUN |
| Session fixation / rotation matrix | manual only |

## Staging exposure

- `https://ai.shotbro.ru/api/` → staging API `127.0.0.1:3021`
- Port 3021 not public — verified in compose
- Recommend: `scripts/nginx-staging-lockdown.sh` + `STAGING_GATE_SECRET`

## Blocked

- Production Selectel credentials (compromised; do not reuse)
- Mandatory email verification on production until SMTP secret rotation
- Production storage cutover

## Helpers

- `signIn()` added in `http-helpers.ts` for tests without public signup
- Download authorization covered in `upload-idor.integration.spec.ts`
