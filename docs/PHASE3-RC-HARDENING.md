# Phase 3 RC hardening + GitHub — финальный отчёт

**Дата:** 2026-10-24  
**Проект:** https://ai.shotbro.ru  
**GitHub:** `git@github.com:letoceiling-coder/ai.shotbro.ru.git`  

---

## Git / GitHub

| Пункт | Значение |
|-------|----------|
| **Remote origin** | `git@github.com:letoceiling-coder/ai.shotbro.ru.git` |
| **phase2/backend** | `e5c4045` → origin |
| **phase3/agent** | RC1 acceptance commit → origin (after `33add8b`, `66c1d2f` hardening) |
| **Tag phase2-rc1** | pushed (unchanged) |
| **Tag phase3-rc1** | **CREATED** after RC1 acceptance |
| **Secret audit (history)** | tracked: только `infra/staging.env.example` (placeholders). Live `staging.env` только на VPS |
| **Force push** | не использовался |

**Commits:** `579593b` (hardening), `66c1d2f` (provision DI + log redaction), `33add8b` (docs/ops), RC1 commit (mobile e2e + ops scripts + acceptance docs).

---

## Staging deployment

| Пункт | Значение |
|-------|----------|
| **DEPLOYED.txt** | `66c1d2f` |
| **Backup** | `/var/backups/shotbro-staging-phase3-20261024-hardening.sql.gz` |
| **Migration 0004** | **APPLIED** (staging + budget test DB) |
| **API image** | `sha256:21516745c50c…` |
| **Worker image** | `sha256:376ea777aeeb…` |
| **Web image** | `sha256:d943d2778efe…` (e2e sidebar `aria-label` in git; optional next web deploy) |

**Flags (API):** `OPENROUTER_ENABLED=false`, `ALLOW_PUBLIC_REGISTER=false`, `INTEGRATION_PROVISION_ENABLED=false` (post-RC1).

---

## Integration users A / B

| Пункт | Статус |
|-------|--------|
| Public sign-up | **OFF** |
| Provisioning | **DISABLED** after RC1 (was loopback + secret during hardening) |
| User A / B | sign-in **200** |
| Security | Loopback-only; header redaction; secret **rotated** on VPS |

---

## Regression (RC1 closeout)

| Suite | Pass | Fail | Skip |
|-------|------|------|------|
| API integration @ staging | **22** | **0** | **9** |
| PostgreSQL `cost-reservation.db.integration` | **3** | **0** | **0** |
| Playwright `phase3-mock-production` desktop | **1** | **0** | **0** |
| Playwright desktop1440 | **1** | **0** | **0** |
| Playwright tablet | **1** | **0** | **0** |
| Playwright mobile | **1** | **0** | **0** |

**Mobile fix files:** `apps/web/e2e/helpers/real-login.ts`, `apps/web/e2e/phase3-mock-production.spec.ts`, `apps/web/src/components/studio/real-projects-sidebar.tsx`.

---

## Hardening deliverables

| Area | Status |
|------|--------|
| CostReservation FOR UPDATE + idempotency + RELEASE | **TESTED** (3 DB tests + staging integration) |
| Worker delivery dedup | **DEPLOYED** |
| Graph invalidation | unit + staging smoke |
| Provision DI + log redact | **66c1d2f** |

---

## Production / AI

| Metric | Value |
|--------|-------|
| Real AI inference calls | **0** |
| Paid image/video/audio | **0** |
| Production cutover | **NOT PERFORMED** |

---

## Ops scripts (VPS)

- `infra/scripts/staging-migrate-0004.sh`
- `infra/scripts/staging-ensure-integration-env.sh`
- `infra/scripts/run-provision-loopback.sh`
- `infra/scripts/staging-signin-smoke.sh`
- `infra/scripts/staging-rotate-provision-secret.sh`
- `infra/scripts/staging-disable-provision.sh`
- `infra/scripts/staging-run-budget-db-tests.sh`
- `infra/scripts/staging-verify-provision-auth.sh`
- `scripts/run-db-integration-tests.sh` (local Docker)

---

## Blockers

**None** for `phase3-rc1` after RC1 closeout.

**Recommendation:** set GitHub default branch to `phase3/agent` (manual).
