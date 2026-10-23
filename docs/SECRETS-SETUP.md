# SHOTBRO AI Studio — секреты и интеграции (Фаза 2)

## Безопасность

- **Не коммитьте** `.env.production`, `.env.local`, файлы с паролями.
- На сервере: `chmod 600 .env.production`, владелец — пользователь сервиса.
- **Не встраивайте** секреты в Docker image; используйте `env_file` или секреты оркестратора.
- Секреты **не попадают** во frontend и не логируются скриптом `integrations:check`.
- Если ключ попал в чат, скриншот или Git — **считайте скомпромированным** и **ротируйте** в панели провайдера.

### Ротация ключей

| Сервис | Действие |
|--------|----------|
| Selectel S3 | Панель → S3-ключи → создать новый → обновить `.env.production` → удалить старый ключ |
| OpenRouter | Settings → API Keys → revoke → новый ключ → обновить env |
| SMTP | Сменить пароль приложения у почтового провайдера |

---

## 1. Локальная настройка

```bash
cp .env.example .env.production
# заполните значения в .env.production (редактор на защищённой машине)
pnpm install
pnpm integrations:check -- --offline
```

После заполнения S3 (и явного разрешения владельца):

```bash
pnpm integrations:check -- --live
```

---

## 2. Selectel Object Storage

### Параметры (ru-3)

| Переменная | Пример |
|------------|--------|
| `S3_ENDPOINT` | `https://s3.ru-3.storage.selcloud.ru` |
| `S3_REGION` | `ru-3` |
| `S3_BUCKET` | имя бакета (например `botsme`) |
| `S3_FORCE_PATH_STYLE` | `false` (по умолчанию для Selectel) |

### Рекомендуемая политика бакета

- **Приватный** бакет (без публичного read).
- Доступ приложения через **ключ S3** с минимальными правами на префиксы проекта (например `projects/`, `uploads/`).
- Раздача файлов пользователям — только **presigned URL** (`S3_PRESIGNED_URL_TTL_SECONDS`).
- CORS: настроить в панели Selectel, когда появятся **прямые загрузки из браузера** (список origin: `https://ai.shotbro.ru`).

### Проверка

`pnpm integrations:check -- --live` выполняет:

- `HeadBucket`
- запись/чтение/удаление тестового объекта в `__system/integration-check/` (не пользовательские данные)
- presigned URL
- пробную multipart-операцию
- чтение CORS (если есть права)

**Не меняйте публичность бакета** без согласования.

---

## 3. OpenRouter (только конфигурация)

```dotenv
OPENROUTER_ENABLED=false
OPENROUTER_ALLOW_PAID_REQUESTS=false
OPENROUTER_MAX_COST_USD=0
```

- Ключ хранится только на сервере (`OPENROUTER_API_KEY`).
- Модуль `@shotbro/config/openrouter` — серверная конфигурация для Фазы 3.
- **Запросы к OpenRouter API в Фазе 2 запрещены**, в том числе «ping» моделей.

---

## 4. SMTP

Поддерживаются два типичных режима:

| Режим | PORT | SMTP_SECURE |
|-------|------|-------------|
| Implicit TLS | 465 | `true` |
| STARTTLS | 587 | `false` |

Используйте **пароль приложения**, если провайдер его выдаёт (Yandex, Google и т.д.).

```dotenv
EMAIL_ENABLED=false   # пока false — письма не отправляются
```

Шаблоны писем: пакет `@shotbro/email` (HTML + text, стиль SHOTBRO).

Live-проверка SMTP (`verify`) выполняется только при `EMAIL_ENABLED=true`.  
Тестовое письмо — только с флагом `--smtp-test` и отдельным подтверждением владельца.

---

## 5. Docker / production server

1. Скопируйте `.env.production` на сервер **вне** git-репозитория, например:  
   `/var/www/ai.shotbro.ru-src/.env.production`
2. В `infra/docker-compose.yml` для сервиса API/worker (Фаза 2+) укажите:

```yaml
env_file:
  - ../.env.production
```

3. Образ **web** (Next.js) **не должен** получать `OPENROUTER_API_KEY` или S3 secret — только публичный `APP_URL`.

---

## 6. Чеклист владельца

- [ ] `.env.production` создан, права `600`
- [ ] S3 ключ с минимальными правами
- [ ] OpenRouter: `ENABLED=false`
- [ ] SMTP: `EMAIL_ENABLED=false` до готовности почты
- [ ] `pnpm integrations:check -- --offline` — OK
- [ ] `pnpm integrations:check -- --live` — OK (после заполнения S3)
- [ ] Старые ключи отозваны, если утекли в чат/скриншот

---

## Шаблон переменных

См. корневые файлы `.env.example` (из `env.example`) и заполненный локально `.env.production` (не в Git).
