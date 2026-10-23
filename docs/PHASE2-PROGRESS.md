# Phase 2 progress log

Legend: **IMPLEMENTED** | **TESTED** | **DEPLOYED** | **BLOCKED** | **NOT IMPLEMENTED**

Last updated: 2026-10-23 (Phase 2 acceptance pass)

Base commit: `2dd93b6` → **HEAD `66cfeb6`** on `phase2/backend`. Authoritative acceptance: **`docs/PHASE2-FINAL-ACCEPTANCE.md`**. VPS src: `/var/www/ai.shotbro.ru-src` (API/worker rebuilt; web REAL UI deployed on :3020).

## Этап 0 — окружение и lint

| Item | Status |
|------|--------|
| `pnpm-workspace.yaml` allowBuilds | IMPLEMENTED |
| `pnpm install` (clean store + reinstall) | TESTED (OK) |
| `pnpm --filter web lint` | TESTED (OK, 2 warnings) |
| `pnpm --filter web typecheck` | TESTED (OK, prior session) |
| `pnpm --filter web build` | TESTED (OK) |
| `pnpm --filter api typecheck` | TESTED (OK in Docker build) |

**Lint root cause (Windows):** corrupted `node_modules` files (e.g. `functions-have-names`, `string.prototype.matchall`) were **774-byte NUL-filled blobs**, not valid JS. Fix: stop locking processes, delete `pnpm` store `v11`, remove `node_modules`, `pnpm install`. This is **not** explained by ignored native build scripts — postinstall for esbuild/sharp/nest ran successfully in Docker and locally after reinstall.

**Production API note:** NestJS under `tsx` does not emit `design:paramtypes`; all injectable constructor deps need explicit `@Inject(...)` (fixed in `apps/api/src/**`).

## Этап 1 — staging infra (VPS)

| Item | Status |
|------|--------|
| `infra/docker-compose.staging.yml` (project `ai-shotbro-staging`) | IMPLEMENTED, DEPLOYED |
| Isolated volumes/network (not studio-shotbro-*) | DEPLOYED |
| Postgres 16 + Redis 7 + MinIO (cached image on host) | DEPLOYED |
| `infra/staging.env` (generated, chmod 600, gitignored) | DEPLOYED |
| `scripts/init-staging-env.sh`, `vps-staging-up.sh` | IMPLEMENTED |
| Local Docker Desktop | BLOCKED (unchanged) |

**VPS checks:** ~29G free on `/`, port `127.0.0.1:3021` → staging API; `infra-web-1` :3020 unchanged (DEMO web).

## Этап 2 — база данных

| Item | Status |
|------|--------|
| Drizzle migrate on staging Postgres | TESTED (OK) |
| 23 public tables | TESTED (count + `\dt` list via smoke script) |
| FK / indexes / Better Auth tables | IMPLEMENTED (schema); spot-check via migrate OK |
| Backup → delete test row → restore | TESTED (`scripts/staging-backup-restore-test.sh` → `BACKUP_RESTORE_OK`; full SQL replay logs schema “already exists” noise — data row count restored) |
| `docs/DATABASE-BACKUP.md` | IMPLEMENTED; staging procedure validated |

## Этап 3 — Auth + projects + messages (API)

| Item | Status |
|------|--------|
| Better Auth `/api/auth/*` | IMPLEMENTED, TESTED (sign-up on staging) |
| `ALLOW_PUBLIC_REGISTER` gate | IMPLEMENTED (staging `true`; prod must stay `false` without SMTP) |
| Session + `/api/v1/users/me` | TESTED (staging smoke) |
| Projects create (workspace bootstrap) | TESTED (staging smoke) |
| Conversations / messages / uploads / approvals routes | IMPLEMENTED; messages E2E | NOT TESTED this session |
| REAL frontend → public API | IMPLEMENTED (nginx); full browser E2E | NOT TESTED |
| DEMO UI + 4 projects | DEPLOYED (3020 unchanged); regression | NOT re-run |

**Working API URLs**

- Staging (loopback): `http://127.0.0.1:3021/api/v1/health/live`
- Public (nginx → staging API): `https://ai.shotbro.ru/api/v1/health/live` → `{"status":"ok"}`

## Этап 4 — Selectel S3

| Item | Status |
|------|--------|
| Presigned init/complete (API code) | IMPLEMENTED |
| Staging MinIO + `ensureS3Bucket` on API boot | IMPLEMENTED, DEPLOYED |
| Multipart, MIME quarantine, thumbnails, worker media | NOT IMPLEMENTED |
| Production Selectel | BLOCKED (compromised keys; owner rotation required) |

## Этап 5 — Approvals

| Item | Status |
|------|--------|
| ApprovalService + API | IMPLEMENTED |
| ApprovalCard → API (web) | NOT IMPLEMENTED |

## Этап 6 — Redis, BullMQ, SSE

| Item | Status |
|------|--------|
| Redis in staging | DEPLOYED |
| Worker container | DEPLOYED (stub) |
| BullMQ enqueue from API | NOT IMPLEMENTED |
| SSE replay / durable log (full spec) | PARTIAL (event log write; limited replay) |

## Этап 7–8 — Security & E2E

| Item | Status |
|------|--------|
| IDOR / security matrix tests | NOT IMPLEMENTED (placeholders remain) |
| `e2e/real-auth.spec.ts` | IMPLEMENTED; NOT TESTED (`E2E_REAL_BACKEND=1` not run) |
| Cross-account isolation | NOT TESTED |

## Этап 9 — Production deployment

| Item | Status |
|------|--------|
| Full production compose (api+worker+pg on prod volumes) | NOT DEPLOYED |
| nginx `/api/` → 3021 | DEPLOYED (staging API only; DEMO web on `/` → 3020 preserved) |
| Secret rotation on server | BLOCKED (owner) |
| OpenRouter | DISABLED (boot guard + env) |
| SMTP / email verification | BLOCKED (no SMTP; no unsafe public prod register) |

## Constraints confirmation

- OpenRouter: **off** (`OPENROUTER_ENABLED=false`, runtime guard).
- No paid AI calls.
- `studio.shotbro.ru` stack **not modified**.
- Compromised Selectel/OpenRouter keys **not used** in staging (MinIO + new staging secrets).

## Remaining blockers (post final fixes)

1. ~~P0 Playwright chain~~ — TESTED (`dfc5b68`).
2. ~~media.cleanup / storage.reconcile~~ — IMPLEMENTED (`66cfeb6`).
3. ~~Approval API + REAL blocks + integration~~ — DONE; Playwright `real-approval.spec.ts` ready.
4. ~~SSE Last-Event-ID integration~~ — TESTED; browser media-job SSE E2E still open.
5. Production cutover (Selectel keys, prod env, SMTP rotate, `EMAIL_VERIFICATION_REQUIRED=true`).
6. Playwright tablet/mobile; browser multipart ≥8MB; DEMO visual regression.

## Changed / added files (this session — summary)

- `infra/docker-compose.staging.yml`, `infra/staging.env.example`, `Dockerfile.api`, `Dockerfile.worker`
- `scripts/init-staging-env.sh`, `vps-staging-up.sh`, `staging-smoke.sh`, `staging-backup-restore-test.sh`, `nginx-add-api-proxy.sh`
- `apps/api/src/auth/*` (SessionGuard `@Inject(AUTH)`, register gate)
- `apps/api/src/**` explicit `@Inject` for tsx/Nest DI
- `apps/api/src/main.ts` + `packages/config/src/s3.ts` (`ensureS3Bucket`)
- `apps/api/src/projects/projects.controller.ts` (service rename)
- `.gitignore` → `infra/staging.env`
