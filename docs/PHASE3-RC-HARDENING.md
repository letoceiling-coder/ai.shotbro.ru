# Phase 3 RC hardening + GitHub — финальный отчёт

**Дата:** 2026-10-24  
**Проект:** https://ai.shotbro.ru  
**GitHub:** `git@github.com:letoceiling-coder/ai.shotbro.ru.git`  

---

## Git / GitHub

| Пункт | Значение |
|-------|----------|
| **Remote origin** | `git@github.com:letoceiling-coder/ai.shotbro.ru.git` — **PUSHED** |
| **phase2/backend** | `e5c4045` → origin |
| **phase3/agent** | **`66c1d2f`** → origin (tracking `origin/phase3/agent`) |
| **Tag phase2-rc1** | pushed |
| **Tag phase3-rc1** | **NOT CREATED** — mobile Playwright 1 fail (desktop pass); см. регрессию |
| **Secret audit (history)** | tracked: только `infra/staging.env.example` (placeholders). Private keys / `.env` / dumps — **не в истории**. Selcloud/SMTP в истории — **закомментированные шаблоны**, не live keys |
| **Force push** | не использовался |

**Commits hardening:** `579593b` (hardening), `66c1d2f` (provision DI + log redaction + loopback script)

---

## Staging deployment

| Пункт | Значение |
|-------|----------|
| **DEPLOYED.txt** | `66c1d2f` |
| **Backup** | `/var/backups/shotbro-staging-phase3-20261024-hardening.sql.gz` (~190 KB) |
| **Migration 0004** | **APPLIED** (Better Auth admin columns) |
| **API image** | `sha256:21516745c50c327…` |
| **Worker image** | `sha256:376ea777aeeb2ac…` |

**Flags (API container):** `OPENROUTER_ENABLED=false`, `ALLOW_PUBLIC_REGISTER=false`

---

## Integration users A / B

| Пункт | Статус |
|-------|--------|
| Public sign-up | **OFF** |
| Provisioning | **OK** — loopback `run-provision-loopback.sh` + Better Auth admin |
| User A | `e2e-phase2@shotbro.test` — **already_exists**, sign-in **200** |
| User B | `e2e-phase2-b@shotbro.test` — **already_exists**, sign-in **200** |
| Security | Loopback-only HTTP (`socket.remoteAddress`); `INTEGRATION_PROVISION_ENABLED`; pino redact on provision/gate headers; CLI path preferred |

**Security finding:** один раз provision secret попал в API access log до redact fix — **рекомендуется ротация** `INTEGRATION_PROVISION_SECRET` на VPS (значение не дублировать в docs).

---

## Regression

| Suite | Pass | Fail | Skip |
|-------|------|------|------|
| API integration @ staging | **31** | **0** | **3** (PostgreSQL DB tests — нет `RUN_DB_INTEGRATION_TESTS` + local DB) |
| `@shotbro/ai` unit | **10** | 0 | 0 |
| API typecheck | pass | — | — |
| Playwright `phase3-mock-production` desktop | **1** | 0 | 0 |
| Playwright mobile | 0 | **1** | 0 (heading «REAL-проект» not visible — UI/mobile flow) |
| Playwright tablet / 1440 | **not run** this session | — | — |

Phase 2 + Phase 3 integration paths covered in 31 tests (incl. hardening, graph smoke, full agent, security isolation).

---

## Hardening deliverables

| Area | Status |
|------|--------|
| CostReservation FOR UPDATE + idempotency + RELEASE ledger | **DEPLOYED** **TESTED** (staging idempotency tests) |
| Worker delivery dedup | **DEPLOYED** (`deliveryMessageId` + assembly skip) |
| Graph invalidation tests | **TESTED** (unit + staging smoke) |
| Tool Executor matrix | mock path **DEPLOYED**; handlers **ADAPTER_PENDING** / **PARTIAL** — см. matrix |

---

## Production / AI

| Metric | Value |
|--------|-------|
| Real AI inference calls | **0** |
| Paid image/video/audio | **0** |
| Production cutover | **NOT PERFORMED** |

---

## Blockers до `phase3-rc1`

1. **Playwright:** mobile (и при необходимости tablet/1440) — стабильный pass.  
2. **Optional:** `RUN_DB_INTEGRATION_TESTS=1` + PostgreSQL для 3 DB budget tests.  
3. **Rotate** `INTEGRATION_PROVISION_SECRET` после log exposure.  
4. **GitHub default branch:** пустой repo — default branch не настраивался (рекомендуется `phase3/agent` или `phase2/backend` в UI GitHub).

---

## Ops scripts (VPS)

- `infra/scripts/staging-migrate-0004.sh`
- `infra/scripts/staging-ensure-integration-env.sh`
- `infra/scripts/run-provision-loopback.sh`
- `infra/scripts/staging-signin-smoke.sh`
- `scripts/provision-integration-users.sh`
