# Phase 3 RC hardening — отчёт

**Дата:** 2026-10-24  
**Проект:** https://ai.shotbro.ru  
**Ветка:** `phase3/agent`  
**Git HEAD (последний commit):** `6b0656ec5851cdbc493fc6d4f664504453ea724e`  
**Hardening:** изменения в working tree (**не закоммичены**)  
**Staging deploy:** `42fb413` (`DEPLOYED.txt` на VPS)  
**Git push:** **BLOCKED** — remote `origin` не настроен  

---

## Итог

Mock-production RC на staging **по-прежнему валиден** на `42fb413`.  
Hardening **готов в коде локально**; для полного закрытия User B и budget-fix на staging нужен **один deploy API/worker** + миграция `0004` + `INTEGRATION_PROVISION_SECRET` в `staging.env`.

**Production cutover:** NOT PERFORMED  
**Paid AI / inference:** 0  

---

## 1. Test users A / B

| Пункт | Статус |
|-------|--------|
| Причина exit 255 (PowerShell/SSH + curl) | **ИСПРАВЛЕНА** — новый путь, не повторять старый curl |
| `ALLOW_PUBLIC_REGISTER=true` на staging | **НЕ ИСПОЛЬЗОВАЛСЯ** |
| Provisioning | **IMPLEMENTED** — `POST /api/v1/internal/integration-users/provision` |
| Механизм | Better Auth **admin** plugin, server-side `createUser` (не public sign-up, не raw SQL) |
| Доступ | localhost / private IP + заголовок `X-Shotbro-Integration-Provision` (≥32 chars) |
| Скрипт | `scripts/provision-integration-users.sh` (идемпотентный, пароли из env, не в логах) |
| Staging gate | provision с localhost обходит gate при валидном provision secret |
| Миграция | `0004_better_auth_admin_fields.sql` + `infra/scripts/staging-migrate-0004.sh` |
| Sign-in A/B на staging после hardening | **BLOCKED** до deploy + migrate + provision + проверки паролей в `staging.env` |

**Действия на VPS (после deploy):**

1. Добавить в `infra/staging.env`: `INTEGRATION_PROVISION_SECRET=…` (≥32), пароли `INTEGRATION_USER_*` / `E2E_TEST_*`.  
2. `bash infra/scripts/staging-migrate-0004.sh`  
3. `bash scripts/provision-integration-users.sh` (с `ENV_FILE=…/staging.env`)  
4. Sign-in A/B через integration tests или `phase3-hardening.integration.spec.ts`.

---

## 2. Git

| Пункт | Статус |
|-------|--------|
| `git status` | изменённые + новые файлы hardening; **нет** commit |
| `origin` | **отсутствует** — push не выполнялся, force push не использовался |
| `phase2-rc1` | не изменялся |
| Untracked deploy tar | `phase3-deploy*.tar` — в `.gitignore` (**IMPLEMENTED**) |
| Достоверный remote URL в репо | **не найден** — push **BLOCKED** |

---

## 3. Budget concurrency

| Пункт | Статус |
|-------|--------|
| Idempotency key в одной транзакции | **IMPLEMENTED** |
| `SELECT … FOR UPDATE` на project | **IMPLEMENTED** |
| Unique violation → вернуть существующую резервацию | **IMPLEMENTED** |
| `RELEASE` → запись в `cost_ledger_entry` | **IMPLEMENTED** |
| Тесты PostgreSQL | **IMPLEMENTED** — `apps/api/test/db/cost-reservation.db.integration.spec.ts` (`RUN_DB_INTEGRATION_TESTS=1` + `DATABASE_URL`) |
| Staging: параллельный reserve один key | **IMPLEMENTED** — `phase3-hardening.integration.spec.ts` (после deploy API с fix) |
| Полная матрица (cancel∥reserve, COST×2 approve, …) | **PARTIAL** — ключевые сценарии в коде/тестах; не все 10 пунктов отдельными кейсами |

**Deploy:** нужен для staging budget-fix (`cost-reservation.service.ts`).

---

## 4. DAG idempotency

| Пункт | Статус |
|-------|--------|
| Дубли `startProductionRun` / graph nodes | **DEPLOYED** — insert только если graph пуст |
| BullMQ `jobId=production-run-{runId}` | **DEPLOYED** |
| Worker: early exit if COMPLETED | **DEPLOYED** |
| Дубль DELIVERY message в чате | **IMPLEMENTED** (local) — `deliveryMessageId` в metadata run |
| Worker crash / MinIO retry / cancel mid-flight | **PARTIAL** — логика частично; нет полного fault-injection CI |
| Второй financial reserve на resume | **DEPLOYED** — idempotency key `cost:{runId}:v{version}` |

**Deploy:** worker с `deliveryMessageId` — после следующего worker deploy.

---

## 5. Character / Prompt → DAG

| Пункт | Статус |
|-------|--------|
| `sceneGraphVersionHash` | **IMPLEMENTED** **TESTED** (unit) |
| Selective invalidation | **IMPLEMENTED** **TESTED** (unit) |
| API wiring (patch scene / prompt / character) | **DEPLOYED** на `42fb413` |
| Integration | **IMPLEMENTED** — planner test + staging smoke `phase3-graph-invalidation.integration.spec.ts` |

---

## 6. Tool Executor

См. [PHASE3-TOOL-EXECUTOR-MATRIX.md](./PHASE3-TOOL-EXECUTOR-MATRIX.md).

| Итог | |
|------|--|
| Mock E2E path | orchestrator + worker — **DEPLOYED** **TESTED** |
| Handlers в ToolExecutor | большинство **NOT IMPLEMENTED** / **PARTIAL** — не помечены как DONE |
| `generate.*` | **ADAPTER_PENDING** — mock через worker; EXTERNAL_PAID **TESTED** (guards) |

---

## 7. Staging regression (последний зафиксированный прогон @ `42fb413`)

| Block | Pass | Fail | Skip |
|-------|------|------|------|
| Phase 2 integration | 19 | 0 | 0 |
| Phase 3 integration | 6 | 0 | 0 |
| Playwright (desktop / 1440 / tablet / mobile) | 4 | 0 | 0 |
| `@shotbro/ai` unit | 10 | 0 | 0 |

**После hardening deploy:** перезапустить integration + Playwright; добавить `phase3-hardening`, `phase3-graph-invalidation`, DB budget tests.

---

## 8. Docker / staging (последняя проверка VPS)

| | |
|--|--|
| DEPLOYED SHA | `42fb413` |
| API image (prefix) | `sha256:e90fcb17…` |
| Web image (prefix) | `sha256:1455932a…` |
| `ALLOW_PUBLIC_REGISTER` | `false` |
| `OPENROUTER_ENABLED` | `false` |

---

## 9. Безопасность

```dotenv
OPENROUTER_ENABLED=false
OPENROUTER_ALLOW_PAID_REQUESTS=false
PROVIDER_LIVE_EXECUTION_ENABLED=false
AI_MOCK_MODE=true
```

---

## Blockers до «закрытого» RC hardening

1. **Commit** hardening + **deploy** API/worker на staging.  
2. **Миграция 0004** + **INTEGRATION_PROVISION_SECRET** + **provision-integration-users.sh** → sign-in B.  
3. **Git origin** + push `phase3/agent`.  
4. Полный прогон regression после deploy.  
5. (Опционально) расширить budget/DAG fault-injection tests; ToolExecutor handlers — не блокируют mock RC.

---

## Связанные документы

- [PHASE3-FINAL-ACCEPTANCE.md](./PHASE3-FINAL-ACCEPTANCE.md) — приёмка RC @ `42fb413`  
- [PHASE3-PROGRESS.md](./PHASE3-PROGRESS.md) — сводный статус фаз  
- [PHASE3-TOOL-EXECUTOR-MATRIX.md](./PHASE3-TOOL-EXECUTOR-MATRIX.md) — матрица инструментов  
