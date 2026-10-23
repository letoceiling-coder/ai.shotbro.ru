# Phase 2 — final acceptance report

**Project:** https://ai.shotbro.ru  
**VPS:** `root@85.117.235.93`  
**Branch:** `phase2/backend`  
**Baseline commit:** `2dd93b6`  
**Phase 2 checkpoint (HEAD):** `dfc5b68`  
**Prior checkpoints:** `3df617e` (REAL backend bundle), `abfa67d` (S3 presign + E2E)  
**Report date:** 2026-10-23  
**Staging:** API `127.0.0.1:3021`, web `127.0.0.1:3020` (`infra-web-1`), MinIO `127.0.0.1:9003`, `ALLOW_PUBLIC_REGISTER=false`

**Phase 2 status:** **P0 user chain met on staging** (auth, projects, chat, browser upload, reload/restore). **Not production-ready.** Remaining gaps: Approval/SSE E2E, full worker soak, prod Selectel, mandatory email verify on prod, extended Playwright matrix (tablet/mobile/isolation).

Legend: **I** = IMPLEMENTED · **T** = TESTED · **D** = DEPLOYED (staging) · **B** = BLOCKED

---

## Git checkpoint (§3)

| Check | Result |
|-------|--------|
| `git status` | Clean at `dfc5b68` |
| Secrets in git | None committed; `infra/staging.env` gitignored |
| Delta from `2dd93b6` | 58 files, +1533 / −84 lines (no `.env` / keys) |

---

## Summary matrix (§12)

| Area | I | T | D | B / notes |
|------|---|---|---|-----------|
| Auth (Better Auth, sessions) | ✓ | ✓ integration + Playwright | ✓ | Prod cutover |
| Register gate | ✓ | ✓ | ✓ `false` on staging | Prod: verify email first |
| Projects / conversations / messages | ✓ | ✓ integration + Playwright | ✓ | — |
| REAL UI (login, register, REAL mode) | ✓ | ✓ Playwright desktop P0 | ✓ web :3020 | Tablet/mobile E2E not run |
| DEMO 4 scenarios | ✓ | prior | ✓ unchanged | — |
| Assets API (list/download/versions) | ✓ | ✓ upload integration | ✓ | — |
| Browser S3 presigned upload | ✓ | ✓ smoke + Playwright | ✓ `/shotbro-staging/` nginx | Selectel prod |
| Multipart upload (≥8MB) | ✓ | ✓ API integration path | ✓ | Browser multipart E2E not run |
| MIME sniff / quarantine | ✓ | ✓ integration | ✓ | — |
| Worker metadata / thumbnail / poster | ✓ | partial smoke | ✓ | Long video soak; ffprobe in worker |
| `media.cleanup` | stub | — | ✓ | Full job TBD |
| `storage.reconcile` | — | — | — | **NOT IMPLEMENTED** |
| Approvals API | ✓ | integration indirect | ✓ | — |
| ApprovalCard → API (UUID blocks) | ✓ | manual | ✓ web | No Playwright; DEMO fallback if no UUID meta |
| SSE + Last-Event-ID | ✓ | ✓ isolation (403 B→A stream) | ✓ | Reconnect + media job E2E not run |
| `@shotbro/ai` registry / orchestrator | ✓ | ✓ unit (3) | ✓ `/api/v1/ai/registry` | — |
| OpenRouter / paid AI | off | ✓ guards | ✓ | Phase 3 |
| Security isolation (IDOR projects/messages/SSE) | ✓ | ✓ 10/10 integration | ✓ | Upload/approval IDOR not in suite |
| SMTP Beget | ✓ | ✓ `pnpm verify:smtp` (local) | ✓ staging.env | **Rotate password if leaked**; full verify flow not prod-enabled |
| Email verification required | ✓ flag | partial | staging `EMAIL_VERIFICATION_REQUIRED=false` | Prod: enable after E2E verify |
| Password reset hooks | ✓ | not full E2E | ✓ | — |
| Production Selectel S3 | prep | MinIO only | — | **New keys required** |
| Prod volumes / backup / cutover | docs + staging backup test | partial | staging only | **BLOCKED** |
| nginx HTTPS / healthchecks | ✓ | ✓ | ✓ | — |

---

## P0 chain (§1, §7) — no paid AI

| Step | Result |
|------|--------|
| LOGIN | ✓ Playwright + E2E user `e2e-phase2@shotbro.test` |
| PROJECT | ✓ REAL create via sidebar |
| CHAT → DATABASE | ✓ message persist |
| UPLOAD | ✓ presigned PUT + complete; counter in REAL thread |
| RELOAD | ✓ message + assets after F5 |
| RESTORE | ✓ re-login + REAL mode + message visible |
| LOGOUT/login (dedicated E2E) | partial (integration signOut); not separate Playwright |
| Second account / file isolation | ✓ integration security suite |
| Approval actions | API only |
| Upload progress UI | not asserted in E2E |

**Playwright (2026-10-23):** `e2e/real-auth.spec.ts` — **1 passed** (desktop, ~6s), unified P0 test. Artifacts: `apps/web/test-results/`.

**Integration:** security 10/10; upload flow OK when `ALLOW_PUBLIC_REGISTER=true` briefly. Sign-up rate limit if many runs in sequence.

---

## Browser S3 (§6)

| Step | Status |
|------|--------|
| 1 Init upload | I/T/D |
| 2 Presigned URL | I/T/D — `https://ai.shotbro.ru/shotbro-staging/{key}?…` |
| 3 Browser PUT | T — smoke + Playwright |
| 4 Host/signature | **Fixed** — `resolveS3SigningEndpoint()` uses origin only; nginx `location /shotbro-staging/` → `:9003` (full URI, no strip) |
| 5 CORS | nginx OPTIONS + Allow-Origin on bucket location |
| 6 Complete | T |
| 7 MIME validation | T integration |
| 8 Quarantine | I (API) |
| 9 Worker metadata | D; T partial |
| 10 Thumbnail (sharp) | D |
| 11 Asset READY | T smoke (PROCESSING → worker); READY not always waited in E2E |
| 12 View/download | I API; browser preview E2E not run |

**Root cause fixed:** presign with `S3_PUBLIC_ENDPOINT=https://ai.shotbro.ru/minio-storage` included `/minio-storage` in SigV4 while nginx stripped prefix → **403**. Legacy `/minio-storage/` location may remain; canonical path is **`/shotbro-staging/`**.

---

## SMTP (§4)

| Item | Status |
|------|--------|
| Beget `smtp.beget.com:465` | I/D via `staging.env` |
| Aliases `SMTP_PASS` / `SMTP_FROM` | I |
| Verification email hook | I |
| `EMAIL_VERIFICATION_REQUIRED` separate from `EMAIL_ENABLED` | I — staging can send mail without blocking sign-up |
| Password reset template | I |
| Rate limit | I (`EMAIL_RATE_LIMIT_PER_HOUR`) |
| Live spam to prod inboxes | Avoided in automation |
| Password rotation after chat leak | **Owner action — not verified here** |

---

## REAL UI & deployment (§5)

| Item | I | T | D |
|------|---|---|---|
| Login / Register pages | ✓ | ✓ | ✓ |
| REAL mode + projects sidebar | ✓ | ✓ | ✓ |
| API client (projects, uploads, assets, approvals) | ✓ | ✓ | ✓ |
| Demo agent in REAL | ✓ off | ✓ | ✓ |
| Visual regression (4 breakpoints/themes) | — | not re-run this session | ✓ |

---

## Worker / SSE (§9)

| Queue | Status |
|-------|--------|
| `media.metadata` | I/D — ffprobe + sharp |
| `media.thumbnail` | I/D |
| `media.poster` | I/D (ffmpeg) |
| `media.cleanup` | stub only |
| `storage.reconcile` | **NOT IMPLEMENTED** |

SSE: implemented with event log; integration proves cross-tenant stream denied. Full Last-Event-ID replay under load **not E2E tested**.

---

## Security (§10)

See `docs/PHASE2-SECURITY-REPORT.md`. Integration: project/message/SSE isolation, unauthenticated 401, logout invalidates session (via cleared cookie in test helper).

**Recommendations not yet applied on public staging:** `STAGING_GATE_SECRET` + `nginx-staging-lockdown.sh`; ensure port 3021 stays loopback-only.

---

## Production readiness (§11)

| Item | Status |
|------|--------|
| Separate prod DB/volumes | B — staging isolated; prod not cut over |
| PostgreSQL backup | T staging script; prod procedure documented |
| Redis / worker / API / web / nginx / HTTPS | D staging; prod B |
| Rollback | documented in this file |
| Selectel | **B** — compromised keys; stay on MinIO staging |

**Do not present staging as production.**

---

## Issues encountered (problems log)

1. **VPS disk 99% full** — Docker builder prune; web rebuild `--no-cache`.
2. **S3 presigned 403** — path prefix vs nginx strip (fixed `abfa67d`).
3. **Playwright “hang” on Windows** — `chromium_headless_shell` + `load` on remote Next.js; fixed with `channel: "chrome"`, `domcontentloaded`.
4. **E2E REAL “Новый проект”** — settings sheet overlay; close with Escape after REAL.
5. **Integration signUp 403/429** — need `Origin` header + temporary `ALLOW_PUBLIC_REGISTER`; rate limit when repeated sign-ups.
6. **Logout integration** — must clear session cookie after sign-out (Better Auth Set-Cookie).
7. **nginx duplicate `ai.shotbro.ru` server blocks** — warnings on reload (pre-existing on VPS).
8. **SMTP password exposure in chat** — rotate on Beget; do not commit.
9. **PHASE2-PROGRESS.md** — was stale; superseded by this report for acceptance.

---

## Verified commands

```bash
pnpm --filter web build && pnpm --filter api typecheck && pnpm --filter @shotbro/ai test
bash scripts/staging-upload-smoke.sh
E2E_REAL_BACKEND=1 E2E_STAGING_URL=https://ai.shotbro.ru \
  E2E_TEST_EMAIL=e2e-phase2@shotbro.test E2E_TEST_PASSWORD=*** \
  pnpm exec playwright test e2e/real-auth.spec.ts --project=desktop
```

---

## Production blockers (must clear before cutover)

1. Rotate Selectel + SMTP + any exposed secrets; new prod env files.
2. `EMAIL_VERIFICATION_REQUIRED=true` + tested verify/reset journey.
3. `ALLOW_PUBLIC_REGISTER=false` on prod (already on staging).
4. Selectel S3 or approved object storage with new keys.
5. Extended QA: Approval E2E, SSE reconnect, multipart browser upload, tablet/mobile Playwright.
6. Implement or defer `storage.reconcile`; flesh out `media.cleanup`.
7. Optional hardening: staging gate + nginx basic auth on `/api/`.

---

## Rollback

1. Restore nginx `*.bak-*` under `/etc/nginx/sites-enabled/`.
2. `docker compose -f infra/docker-compose.staging.yml down` (does not stop `infra-web-1` :3020).
3. Remove `/api/` and `/shotbro-staging/` locations for DEMO-only site.

---

## OpenRouter / paid AI (§2)

**Disabled.** No test inference. Phase 3 only with explicit budget and `OPENROUTER_ALLOW_PAID_REQUESTS=false` until approved.
