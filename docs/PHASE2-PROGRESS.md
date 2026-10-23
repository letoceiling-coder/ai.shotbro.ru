# Phase 2 progress log

Legend: **IMPLEMENTED** | **TESTED** | **DEPLOYED** | **BLOCKED** | **NOT IMPLEMENTED**

## Этап 0 — безопасность и зависимости

| Item | Status |
|------|--------|
| `docs/SECRET-ROTATION-CHECKLIST.md` | IMPLEMENTED |
| S3 live tests gated (`SECRETS_ROTATED=true`) | IMPLEMENTED |
| `pnpm-workspace.yaml` allowBuilds | IMPLEMENTED |
| `pnpm install` | TESTED (OK) |
| `pnpm --filter web lint` | **BLOCKED** (corrupted ESLint transitive packages on Windows disk) |
| `pnpm --filter web build` | TESTED (OK) |
| `pnpm --filter api typecheck` | TESTED (OK) |

## Этап 1 — тестовая инфраструктура

| Item | Status |
|------|--------|
| `infra/docker-compose.dev.yml` | IMPLEMENTED |
| `scripts/migrate-test-db.sh` | IMPLEMENTED |
| Docker up locally | **BLOCKED** (Docker Desktop not running on dev machine) |
| Migration apply + backup/restore | NOT IMPLEMENTED (needs Docker/DB) |

## Этап 2 — Better Auth + Auth UI

| Item | Status |
|------|--------|
| Better Auth on `/api/auth/*` | IMPLEMENTED |
| Login `/login`, Register `/register` | IMPLEMENTED |
| Settings: DEMO/REAL + account | IMPLEMENTED |
| Email verification in prod | **BLOCKED** (no SMTP) |
| Auth E2E | IMPLEMENTED (skipped unless `E2E_REAL_BACKEND=1`) |

## Этап 3 — проекты и сообщения

| Item | Status |
|------|--------|
| Projects CRUD + duplicate/archive/restore/delete/search | IMPLEMENTED (API) |
| Conversations API | IMPLEMENTED |
| Messages + idempotency + events | IMPLEMENTED |
| REAL sidebar + RealThread + TanStack Query | IMPLEMENTED |
| DEMO unchanged | TESTED (build) |
| Cross-device persistence | NOT IMPLEMENTED (needs deployed API + auth E2E) |

## Этап 4 — Selectel S3

| Item | Status |
|------|--------|
| Presigned init/complete | IMPLEMENTED |
| Multipart, MIME quarantine, thumbnails | NOT IMPLEMENTED |
| Production S3 tests | **BLOCKED** until key rotation |

## Этап 5 — Approvals

| Item | Status |
|------|--------|
| ApprovalService + version/hash/idempotency | IMPLEMENTED (API) |
| ApprovalCard → API | NOT IMPLEMENTED |

## Этап 6 — Redis, BullMQ, SSE

| Item | Status |
|------|--------|
| Event log + outbox write | IMPLEMENTED |
| SSE stream endpoint | IMPLEMENTED (initial replay batch) |
| Worker media jobs | NOT IMPLEMENTED (stub only) |
| BullMQ enqueue from API | NOT IMPLEMENTED |

## Этап 7–8 — Security & E2E

| Item | Status |
|------|--------|
| IDOR integration tests | NOT IMPLEMENTED (placeholder spec) |
| Full security matrix | NOT IMPLEMENTED |
| `e2e/real-auth.spec.ts` | IMPLEMENTED (conditional skip) |
| DEMO regression e2e | NOT re-run this session |

## Этап 9 — Production deployment

| Item | Status |
|------|--------|
| Compose stack (postgres/redis/api/worker/web) | IMPLEMENTED (files) |
| nginx `/api/` example | IMPLEMENTED |
| VPS deploy | **NOT DEPLOYED** |
| Secret rotation on server | **BLOCKED** (owner action) |

## Constraints

- OpenRouter: disabled (boot guard)
- No AI generations
- Pre-rotation S3 keys must not be used in production
