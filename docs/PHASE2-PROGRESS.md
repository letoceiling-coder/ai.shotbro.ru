# Phase 2 progress log

Status legend: **IMPLEMENTED** | **TESTED** | **DEPLOYED** | **BLOCKED** | **NOT IMPLEMENTED**

## Stage A — audit & checkpoint

| Item | Status |
|------|--------|
| PHASE2-AUDIT.md | IMPLEMENTED |
| Git tag `phase1-ui-checkpoint` | IMPLEMENTED |
| Branch `phase2/backend` | IMPLEMENTED |
| Fix nested `apps/web` git submodule | IN PROGRESS |
| Lint repair | BLOCKED (pnpm ignored builds — run `pnpm approve-builds`) |

## Stage B — PostgreSQL

| Item | Status |
|------|--------|
| Drizzle schema (23 tables) | IMPLEMENTED |
| Migration `0000_hesitant_the_order.sql` | IMPLEMENTED |
| DATABASE-BACKUP.md | IMPLEMENTED |
| Apply migration on staging/prod | NOT IMPLEMENTED |
| Backup/restore verified | NOT IMPLEMENTED |

## Stage C — Auth

| Item | Status |
|------|--------|
| Better Auth + Drizzle adapter | IMPLEMENTED (code) |
| SessionGuard on API routes | IMPLEMENTED |
| Register/login UI | NOT IMPLEMENTED |
| Email verification (SMTP) | BLOCKED (no SMTP) |
| Security integration tests | NOT IMPLEMENTED |

## Stage D — Projects & chat

| Item | Status |
|------|--------|
| Projects CRUD (partial) | IMPLEMENTED (list/create/get/patch) |
| Duplicate/archive/soft delete | NOT IMPLEMENTED |
| Messages POST (user only, no AI) | IMPLEMENTED |
| UI wired to API (REAL mode) | NOT IMPLEMENTED (DEMO unchanged) |
| TanStack Query project list | NOT IMPLEMENTED |

## Stage E — S3

| Item | Status |
|------|--------|
| Upload init/complete presigned | IMPLEMENTED |
| Multipart upload API | NOT IMPLEMENTED |
| Worker metadata/thumbnails | NOT IMPLEMENTED (stub worker) |
| MIME quarantine | NOT IMPLEMENTED |

## Stage F — Approvals & events

| Item | Status |
|------|--------|
| Approval API | NOT IMPLEMENTED |
| SSE + event log replay | NOT IMPLEMENTED |
| Outbox publisher | NOT IMPLEMENTED |
| BullMQ job enqueue from API | NOT IMPLEMENTED |

## Stage G — Deployment

| Item | Status |
|------|--------|
| docker-compose postgres/redis/api/worker | IMPLEMENTED (compose file) |
| nginx `/api/` example | IMPLEMENTED |
| Production rollout | NOT IMPLEMENTED |
| Zero-downtime | NOT IMPLEMENTED |

## Stage H — QA

| Item | Status |
|------|--------|
| API typecheck | TESTED |
| Unit/integration/e2e REAL flows | NOT IMPLEMENTED |
| Visual regression | NOT IMPLEMENTED |

## Constraints verified

- OpenRouter: **not connected** (`OPENROUTER_ENABLED=false` guard in API boot)
- No AI generations in worker/API
- DEMO UI preserved (default `StudioModeProvider` = DEMO)
