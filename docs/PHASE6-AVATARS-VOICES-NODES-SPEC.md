# Phase 6 — Аватары, голоса, нодовый холст сцен и подтверждаемые генерации

**Статус:** 6A ЗАДЕПЛОЕН на staging и проверен (API `763af2c7`) · 6B–6G не начаты  
**Дата:** 2026-10-30 · **Базовый Git:** `74324c7` (`phase5/creative-studio`)  
**Зависимость:** Phase 5L-B **ACCEPTED** (`PHASE5L_B_ALL_PASS`, `74324c74`, 2026-10-29).  
**Политика на время разработки:** `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false`. Реальные вызовы HeyGen / ElevenLabs / Fal — только на этапе 6G по отдельному разрешению.

---

## 1. Цель

Пользователь в одном чате с агентом:

1. Создаёт **аватар** (из своих фото) один раз и **переиспользует** его в любых проектах.
2. **Выбирает голос** из библиотеки ElevenLabs с прослушиванием или **создаёт свой**: клон по записи (IVC) или голос по описанию (Voice Design).
3. Собирает ролик на **нодовом холсте сцен** (как Magnific Spaces): текст → кадр → видео → голос → монтаж.
4. Любое платное действие агент **сначала предлагает** (2–3 варианта со стоимостью), а выполняет **только после подтверждения**. Сервер это **проверяет сам**, а не полагается на промпт.

## 2. Исходное состояние (аудит 2026-10-30)

| Область | Есть | Нет |
|---|---|---|
| Персонажи | `CharacterProfile` в `project_memory` (только внутри проекта), фото-референсы, `voiceNotes` (текст) | Сущностей «аватар» и «голос» уровня workspace, связи персонаж → аватар/голос |
| Провайдеры | Адаптеры `fal-flux-image`, `fal-minimax-video`, `elevenlabs-tts`, `magnific-upscaler`, `openrouter-media` (`/images`, `/videos`) с contract-тестами; `ProviderJobManager` с режимами mock/live | HeyGen, IVC, Voice Design. Адаптеры **не подключены к воркеру**: `apps/worker/src/production-node.ts` и `production-run.ts` отдают fixtures |
| Граф | `production_graph_node` (зависимости, стоимость, `requiresApproval`), `graph-planner` | Визуального редактора, типизированных портов, истории запусков узла |
| Согласования | `approval` (`targetType/targetId/targetVersion/payloadHash`), `budget_reservation`, `cost_ledger_entry`, `costClass`/`requiresApproval` у инструментов | Проверки «платный инструмент ⇒ есть APPROVED approval с тем же `payloadHash`» на уровне исполнения; карточки «варианты со стоимостью» |
| UI | Единый `/studio`, 11 вкладок на английском | Русской навигации, библиотеки аватаров и голосов, холста |
| Env на сервере | `OPENROUTER_*`, `ELEVENLABS_API_KEY`, `MAGNIFIC_*` | `FAL_API_KEY`, `HEYGEN_API_KEY`, `ELEVENLABS_PROVIDER_ENABLED` |
| Блокер | — | `apps/api/src/main.ts` запрещает `OPENROUTER_ENABLED && MEDIA_GENERATION_ENABLED` |

## 3. Внешние API (сверено 2026-10-30; поля проверить по reference перед 6A)

### HeyGen (прямой ключ `HEYGEN_API_KEY`, заголовок `X-Api-Key`)
| Шаг | Endpoint |
|---|---|
| Загрузка фото | upload asset → `image_key` |
| Группа аватара | `POST /v2/photo_avatar/avatar_group/create` → `group_id` |
| Добавить looks | `POST /v2/photo_avatar/avatar_group/add` |
| Обучение | `POST /v2/photo_avatar/train`; статус `GET /v2/photo_avatar/train/status/{group_id}` |
| Список | `GET /v2/avatar_group.list`, looks группы → `id` = `talking_photo_id` |
| Видео | `POST /v2/video/generate`: `character.type=talking_photo` + `talking_photo_id`; `voice.type=text` (`voice_id`, `input_text`) **или** `voice.type=audio` (готовая озвучка ElevenLabs) |
| Статус | `GET /v1/video_status.get?video_id=` (+ webhook) |

**Через OpenRouter** (`heygen/…` в `/videos`, ≈$0.01–0.02/сек) — генерация роликов с речью по тексту, первому кадру и референсам. Постоянного avatar ID, клонирования голоса и lip-sync под свою озвучку нет. Используем как **дешёвый режим «персонаж в кадре»** без гарантии идентичности; постоянные аватары — только прямой HeyGen API.

### ElevenLabs (`ELEVENLABS_API_KEY`, уже на сервере)
| Функция | Endpoint | Стоимость |
|---|---|---|
| Библиотека голосов | `GET /v2/voices` (свои), shared library | бесплатно; у голоса есть `preview_url` |
| TTS | `POST /v1/text-to-speech/{voice_id}` (адаптер есть) | символы |
| **Клон (IVC)** | `POST /v1/voices/add` multipart: `name`, `files[]`, `remove_background_noise`, `description`, `labels` → `voice_id`, `requires_verification` | по тарифу (IVC — платный план) |
| **Дизайн голоса** | `POST /v1/text-to-voice/design`: `voice_description` (20–1000 симв.), `text`/`auto_generate_text` → 3 `previews` (`generated_voice_id`, `audio_base_64`) | кредиты |
| Сохранить дизайн | `POST /v1/text-to-voice` c `generated_voice_id`, `voice_name`, `voice_description` | — |

## 4. Модель данных (новые таблицы, миграция `0007`)

Аватары и голоса живут на уровне **workspace**: один раз создал, используешь во всех проектах. Персонаж проекта на них **ссылается**.

```text
voice_profile
  id, workspace_id, owner_id, name, description
  provider            'elevenlabs'
  provider_voice_id   null до создания
  kind                LIBRARY | CLONED | DESIGNED
  labels jsonb        {language, gender, age, accent}
  settings jsonb      {stability, similarity_boost, style, speed, model_id}
  preview_asset_id    → asset (наш MinIO, не внешний URL)
  sample_asset_ids    uuid[]  (записи для IVC)
  consent_asset_id    → asset (запись/скан согласия) · consent_confirmed_at · consent_text_version
  status              DRAFT | AWAITING_APPROVAL | CREATING | READY | FAILED | ARCHIVED
  provider_job_id     → provider_job
  created_at, updated_at, archived_at

avatar_profile
  id, workspace_id, owner_id, name, description
  provider            'heygen' | 'openrouter_prompted'
  provider_group_id   HeyGen group_id
  source_asset_ids    uuid[]  (исходные фото)
  default_voice_profile_id → voice_profile
  consent_*           как у голоса (фото реального человека)
  status              DRAFT | AWAITING_APPROVAL | TRAINING | READY | FAILED | ARCHIVED
  provider_job_id, created_at, updated_at, archived_at

avatar_look
  id, avatar_id, provider_look_id (= talking_photo_id), label, preview_asset_id, is_default

canvas (production_document, новый docType SCENE_CANVAS)
  payload: { nodes[], edges[], viewport }, версия + оптимистичная блокировка как у STORYBOARD
```

Изменения в существующем:
- `CharacterProfileSchema` += `avatarProfileId?`, `avatarLookId?`, `voiceProfileId?` (`voiceNotes` остаётся подсказкой).
- `production_doc_type` += `SCENE_CANVAS`.
- `ProviderJob.operation` += `VOICE_CLONE`, `VOICE_DESIGN`, `VOICE_SAVE`, `AVATAR_TRAIN`, `AVATAR_VIDEO`.
- `ReferenceRole.VOICE` уже есть — используется для образцов IVC.
- Доступ: `AccessPolicyService.assertWorkspaceAccess` для новых сущностей (по образцу project isolation); IDOR-тесты обязательны.

## 5. Провайдерский слой

1. **Новые адаптеры** (`packages/ai/src/providers/`), каждый с mock-двойником и contract-тестом на записанных ответах:
   - `heygen-avatar-adapter.ts` — `AVATAR_TRAIN` (create group → add → train → poll), `AVATAR_VIDEO` (generate → poll/webhook).
   - `elevenlabs-voice-adapter.ts` — `listVoices` (без задания, read-only), `VOICE_CLONE`, `VOICE_DESIGN`, `VOICE_SAVE`.
   - `OpenRouterVideoAdapter` — добавить модель `heygen/*` в каталог как `AVATAR_SCENE` (дешёвый режим).
2. **Воркер исполняет задания реально** (за флагами): новый `provider-execution.ts` в воркере берёт `provider_job`, выбирает адаптер из `provider-registry`, вызывает `ProviderJobManager.submitWithAdapter`, опрашивает статус, скачивает результат **в MinIO** (`production-asset-ingestion`), пишет `cost_ledger_entry`, эмитит SSE. При mock-режиме — те же шаги на fixtures, поэтому E2E проверяют настоящий путь.
3. **Флаги и env** (`packages/config/src/env.ts`):
   `HEYGEN_API_KEY`, `HEYGEN_BASE_URL`, `HEYGEN_PROVIDER_ENABLED`, `HEYGEN_WEBHOOK_SECRET`, `ELEVENLABS_PROVIDER_ENABLED`, `VOICE_CLONING_ENABLED`, `AVATAR_GENERATION_ENABLED`, `FAL_API_KEY`, `FAL_PROVIDER_ENABLED`. Любая live-операция требует: `!AI_MOCK_MODE && PROVIDER_LIVE_EXECUTION_ENABLED && <VENDOR>_PROVIDER_ENABLED && <FEATURE>_ENABLED`.
4. **Переработать guard в `main.ts`:** вместо «запрет OpenRouter + media» — запрет live-медиа без бюджетных лимитов (`MEDIA_RUN_MAX_COST_USD`, `MEDIA_USER_DAILY_MAX_USD`) и без включённого approval enforcement.

## 6. Агент: инструменты и протокол подтверждения

### 6.1 Протокол «предложи → оцени → подтверди → выполни»
1. Агент вызывает `propose_generation_options` (бесплатно). Сервер считает стоимость через `cost-engine` по реальному каталогу цен и возвращает блок **`cost_options`**: 2–3 варианта («Эконом / Стандарт / Премиум»: модель, длительность, качество, цена, время).
2. Пользователь выбирает вариант кнопкой в карточке. Создаётся `approval` с `payloadHash` (модель + параметры + входы) и `budget_reservation`.
3. Платный инструмент вызывается с `approvalId`. **Сервер** проверяет: approval `APPROVED`, не истёк, `payloadHash` совпадает, резерв на месте. Иначе — `APPROVAL_REQUIRED`, задание не создаётся. Это закрывает обход через промпт.
4. По завершении: списание по факту (`cost_ledger_entry`), излишек резерва освобождается, результат — карточкой в чате и в библиотеке.

### 6.2 Новые инструменты

| Инструмент | sideEffect | costClass | Approval |
|---|---|---|---|
| `list_voices` (фильтры язык/пол/возраст/акцент), `preview_voice` | READ_ONLY | free | нет |
| `list_avatars`, `get_avatar` | READ_ONLY | free | нет |
| `create_voice_draft`, `create_avatar_draft` | DATABASE_WRITE | free | нет |
| `assign_voice_to_character`, `assign_avatar_to_character` | DATABASE_WRITE | free | нет |
| `propose_generation_options` | READ_ONLY | free | нет |
| `design_voice_previews` | EXTERNAL_PAID | paid | **да** |
| `save_designed_voice` | EXTERNAL_PAID | paid | **да** (дешёвое, но создаёт голос в аккаунте) |
| `clone_voice` | EXTERNAL_PAID | paid | **да** + согласие загружено |
| `train_avatar` | EXTERNAL_PAID | paid | **да** + согласие |
| `generate_first_frame`, `generate_scene_video`, `generate_voiceover`, `generate_avatar_video` | EXTERNAL_PAID | paid | **да** |
| `get_canvas`, `add_canvas_node`, `connect_canvas_nodes`, `run_canvas_node` | READ/DB_WRITE; run → paid | — | run → **да** |

### 6.3 Чтобы агент понимал инструменты
- Описания инструментов и системный промпт — **на русском**, с правилом: «никогда не вызывай платный инструмент без `approvalId`; сначала `propose_generation_options`».
- `get_studio_capabilities` — манифест: какие провайдеры включены, режим (mock/live), цены, лимиты бюджета, что требует согласия. Агент вызывает его в начале сессии.
- Eval-набор (`agent-evaluation.fixtures.ts`) расширить сценариями: «сделай аватар из фото», «подбери голос», «создай голос по описанию», «озвучь сцену 2», где проверяется порядок вызовов и отсутствие платных вызовов без approval.

## 7. Нодовый холст сцен («Сцены», как Magnific Spaces)

- Библиотека: **`@xyflow/react` 12.x** (MIT), версию закрепить в `pnpm-lock`.
- **Узлы** (порт → цвет): Текст/Промпт (text), Материал из библиотеки (image/video/audio), Персонаж (avatar+voice), Аватар (avatar), Голос (voice), Первый кадр — генерация (text,image → image), Видео сцены i2v / start-end (image → video), Видео с аватаром (avatar, text|audio → video), Озвучка TTS (text, voice → audio), Апскейл (image → image), Монтаж (video[], audio[] → video), Выдача (video).
- **Единый источник правды:** холст — это вид поверх `STORYBOARD` и `production_graph_node`, а не копия. Узел ссылается на `sceneId`/`assetId`/`avatarId`/`voiceId`; правка в раскадровке видна на холсте и наоборот (через `invalidateCreativeProjectQueries` + SSE).
- **Запуск узла:** кнопка «Запустить» → карточка вариантов со стоимостью → подтверждение → задание; на узле — статус, прогресс, превью и **история запусков** (каждый run — версия ассета). Можно перезапустить одну сцену без пересборки всего ролика.
- «Собрать всё» запускает граф топологически, но с **одним общим подтверждением** на суммарную стоимость.
- Автосохранение холста (как в Spaces), F5 восстанавливает viewport и выделение.
- Агент строит холст сам по сценарию (`sync_canvas_from_storyboard`), пользователь правит руками.

## 8. Интерфейс

**Навигация (русская, 6 разделов вместо 11):**
`Чат` · `Сценарий` (бриф + сценарий + раскадровка) · `Сцены` (холст) · `Персонажи` (персонажи проекта + выбор аватара и голоса) · `Монтаж` (таймлайн + production + результат) · `Материалы`.
Отдельные страницы: **`/studio/library/avatars`**, **`/studio/library/voices`** (уровень workspace), `/settings` (провайдеры, лимиты бюджета, авто-переход).

**Голоса:** список с кнопкой ▶ (preview), фильтры, «Назначить персонажу». «Создать голос» — две вкладки:
- *Клонировать:* загрузка 1–3 записей (рекомендация ≥1 мин чистой речи), обязательная галочка и файл согласия, цена → «Подтвердить».
- *Описать:* текст описания → «Показать 3 варианта» (платно, с подтверждением) → прослушать → «Сохранить».

**Аватары:** мастер «Фото → голос по умолчанию → стоимость → подтверждение → обучение (статус в реальном времени) → looks». Карточка аватара: looks, голос, «Использовать в проекте».

**Чат:** новые карточки `cost_options` (варианты с кнопками), `voice_result` (плеер), `avatar_result` (превью + статус обучения). Все обновления — через SSE без F5.

**Понятность:** на каждой платной кнопке — цена и пометка «mock» в тестовом режиме; бюджет проекта виден в правой панели; при отказе — понятная причина («нет согласия», «превышен дневной лимит»).

## 9. Безопасность и деньги

- Согласие на голос/лицо реального человека: файл + чекбокс + версия текста, хранится и логируется в `audit_event`; без него `clone_voice`/`train_avatar` отклоняются сервером.
- Лимиты: на запуск, на пользователя в день, на проект; `budget_reservation` до вызова, списание по факту.
- Идемпотентность: `idempotencyKey` = hash(approvalId + payloadHash); повтор не создаёт второе платное задание.
- Webhook HeyGen — проверка подписи (`HEYGEN_WEBHOOK_SECRET`), как у Magnific.
- Результаты всегда копируются в MinIO; внешние URL наружу не отдаются (`shotbro-asset://`).
- Kill switch на каждого провайдера через env без деплоя кода.

## 10. Этапы и критерии приёмки

| Этап | Содержание | Приёмка (mock) |
|---|---|---|
| **6A** | Контракты, миграция `0007`, `voice_profile`/`avatar_profile`/`avatar_look`, API CRUD, access policy, mock-адаптеры HeyGen и EL Voice | unit + integration, IDOR-тесты, миграция на копии БД |
| **6B** | Воркер исполняет `provider_job` через адаптеры (mock-транспорт), ingestion в MinIO, ledger, SSE; новый guard в `main.ts` | integration: задание → ассет → ledger; mock-политика не нарушена |
| **6C** | Инструменты агента, `propose_generation_options`, серверная проверка approval, манифест возможностей, русские описания | agent eval: 0 платных вызовов без approval; integration-тест обхода |
| **6D** | Библиотека голосов и аватаров, мастера создания, связь с персонажами, русская навигация | Playwright: выбрать голос, «клонировать» (mock), создать аватар (mock), F5 |
| **6E** | Нодовый холст, синхронизация с раскадровкой, запуск узла с подтверждением, история | Playwright: собрать сцену на холсте → mock MP4, перезапуск одной сцены |
| **6F** | Полный mock-сценарий: идея → аватар → голос → сцены → монтаж → MP4 в чате | `PHASE6_ALL_PASS`, regression-strict 8/8 |
| **6G** | **Реальные тесты** (по отдельному разрешению): ключи в env, по одному запуску на операцию с лимитом бюджета | ручной протокол: 1 TTS, 1 дизайн голоса, 1 IVC, 1 кадр, 1 видео, 1 аватар + видео |

## 11. Решения заказчика (2026-10-30)

1. **ElevenLabs:** нужно именно клонирование голоса (IVC). Тариф платный — IVC доступен.
2. **Приоритет провайдеров видео и аватаров:** **HeyGen → Fal → OpenRouter**. Если нет `HEYGEN_API_KEY` — Fal; если нет `FAL_API_KEY` — OpenRouter (`/videos`, ключ уже есть). Выбор делает сервер (`resolveMediaProviderChain`), агент и UI показывают, кто выбран и почему.
3. **Лимиты для реальных тестов — минимальные** (стартовые значения для 6G: `MEDIA_RUN_MAX_COST_USD=1`, `MEDIA_USER_DAILY_MAX_USD=3`, ролик ≤ 10 с, 1 сцена на запуск).
4. **Тема реальных тестов 6G:** рекламная кампания сайта **shotbro.ru** (собственный бренд — без чужих лиц/брендов; голос и лицо — только с согласием их владельца).

## 12. Риски

| Риск | Мера |
|---|---|
| Поля HeyGen/EL API отличаются от описанных | contract-тесты по reference до 6B, адаптер изолирует формат |
| Агент вызывает платное без подтверждения | серверная проверка approval (6C), eval-тесты |
| Холст рассинхронизирован с раскадровкой | один источник правды, ссылки по id, оптимистичная блокировка |
| Трафик видео через NL-прокси | скачивание результатов напрямую, если провайдер доступен без прокси; NL не трогаем |
| Юридические риски клонов | обязательное согласие, аудит, возможность удалить голос/аватар у провайдера |

## 13. Статус 6A (2026-10-30)

| Часть | Файлы |
|---|---|
| Контракты | `packages/contracts/src/talent.ts`, `CharacterProfile` += `voiceProfileId/avatarProfileId/avatarLookId` |
| БД | `packages/db/src/schema/talent.ts`, миграция `0007_talent_profiles.sql` (аддитивная), `infra/scripts/staging-migrate-0007.sh` |
| Env | `HEYGEN_*`, `VOICE_CLONING_ENABLED`, `AVATAR_GENERATION_ENABLED`, `MEDIA_RUN_MAX_COST_USD=1`, `MEDIA_USER_DAILY_MAX_USD=3` |
| Провайдеры | `heygen-avatar-adapter.ts`, `elevenlabs-voice-adapter.ts`, `mock-talent-providers.ts`, `media-provider-chain.ts`; транспорт: multipart + raw body |
| API | `apps/api/src/talent/*`: `/api/v1/voices`, `/voices/library`, `/avatars`, `/talent/provider-chain`, `PATCH /projects/:id/characters/:cid/talent`; `AccessPolicyService.assertWorkspaceAccess` |
| Тесты | `talent-providers.contract.test.ts` (18), `phase6-talent.integration.spec.ts` (IDOR, согласие, связи; запуск на staging после миграции) |

Платных endpoint'ов в 6A нет: клонирование, дизайн голоса и обучение аватара появятся в 6B/6C только через approval.

### Staging (2026-10-29 UTC)

| Шаг | Результат |
|---|---|
| Бэкап БД до миграции | `/var/backups/shotbro/staging-pre-0007-20261029-222449.dump` (7,7 МБ, 34 таблицы) |
| Миграция `0007` | применена, таблицы `voice_profile`, `avatar_profile`, `avatar_look` созданы |
| Деплой API | `763af2c7`, healthy, `/health/ready` ok; web `74324c74`, worker `20539645` без изменений |
| `phase6a-talent-integration.sh` | **11/11**, `PHASE6A_TALENT_INTEGRATION_PASS` — лог `phase6a-talent-integration-763af2c7.log` |
| `regression-strict` | **8/8**, `EXIT_CODE=0` — лог `regression-strict-763af2c7.log` |
| Mock-политика | без изменений: `AI_MOCK_MODE=true`, live/media выключены |

## 14. Статус 6B (2026-10-30)

| Часть | Реализация |
|---|---|
| Очередь | `talent.execute` (BullMQ, `attempts: 1` — без авто-повторов платных вызовов); один job на строку `provider_job` |
| API | `POST /api/v1/talent/operations` (`VOICE_CLONE`, `VOICE_DESIGN`, `VOICE_SAVE`, `AVATAR_TRAIN`), `GET /api/v1/talent/jobs/:id`; проверки: вид голоса, согласие, образцы, выбранный вариант, «уже выполняется» (409), идемпотентность по `operation+talent+version` |
| Воркер | `apps/worker/src/talent-execution.ts`: повторная проверка арендатора ассетов, загрузка образцов/фото из MinIO, вызов адаптера, превью дизайна → MinIO, looks аватара, `cost_ledger_entry`, событие `talent.updated` в `event_log` (SSE) |
| Аватар без HeyGen | `REFERENCE`: фото становятся looks сразу, бесплатно, без провайдера |
| Live-шлюзы | `liveTalentBlockers`: режим `LIVE_APPROVED`, политика live-медиа, флаг вендора, флаг функции, **подтверждённый approval**. Вне mock-режима закрытый шлюз = задание `FAILED/LIVE_BLOCKED`, **никогда** не подменяется mock-результатом |
| Startup guard | `assertLiveMediaStartupPolicy` заменил запрет «OpenRouter + media»: live-медиа требует `!AI_MOCK_MODE`, `PROVIDER_LIVE_EXECUTION_ENABLED`, лимиты в пределах (≤ $20 запуск, ≤ $100 день, запуск ≤ день) и enforcement approvals — до 6C всегда блок |
| Исправлено попутно | загрузка `audio/wav` отклонялась (формат разрешён, но не распознавался) — нужна для образцов голоса |
| Тесты | config 12, ai 21, integration 6B: дизайн → 3 превью → сохранение, клон из WAV с согласием, двойной клик, изоляция B, аватар REFERENCE |

### Staging 6B (2026-10-29 UTC)

| Шаг | Результат |
|---|---|
| Деплой API + worker | `a7f4441e`, оба running, `/health/ready` ok; rollback-образы сохранены |
| Integration 6A+6B | **15/15**, `PHASE6A_TALENT_INTEGRATION_PASS` — `phase6-talent-integration-a7f4441e.log` |
| `regression-strict` | **8/8**, `EXIT_CODE=0` — `regression-strict-a7f4441e.log` |
| Mock-политика | без изменений; все talent-задания выполнены mock-провайдерами, $0 |

## 15. Статус 6C (2026-10-30)

**Протокол:** агент/UI → `POST /talent/operations/quote` → карточка в чате «Действие — ≈$X (тест: $0)» с кнопками «Утвердить / Отклонить», бюджет удерживается (`budget_reservation` HELD, 30 мин) → пользователь утверждает → `ApprovalsService` вызывает обработчик `TALENT_OPERATION` → сервер запускает задание → воркер `CAPTURED` / `RELEASED`.

| Гарантия | Где проверяется |
|---|---|
| Нет запуска без APPROVED approval | `TalentJobsService.start` (409 `approval_required`) + воркер (`APPROVAL_REQUIRED`) в любом режиме |
| Approval привязан к операции, таланту, выбранному варианту, версии таланта и цене | sha256 канонического `talentApprovalPayload`; изменение → 409 `approval_mismatch`, резерв снимается |
| Одно approval = одно задание | идемпотентность `talent-approval:<id>` |
| Лимиты $1 на запуск / $3 в день на пользователя | `evaluateBudgetCaps` при котировке (409 `run_cap_exceeded` / `daily_cap_exceeded`) |
| Истёкшая котировка | 409 `quote_expired`, резерв снят |
| Отклонение / правки | резерв `RELEASED`, ничего не запускается |
| Агент не может потратить деньги | ни одного LLM-инструмента с `EXTERNAL_PAID`; `propose_talent_operation` создаёт только карточку |

**Инструменты агента (русские описания):** `get_studio_capabilities` (провайдеры, mock/live, цены, лимиты), `list_voices`, `list_avatars`, `create_voice_profile`, `create_avatar_profile`, `assign_talent_to_character`, `propose_talent_operation`. Системный промпт: сначала возможности, платное — только через предложение с ценой, 2–3 варианта со стоимостью, согласие для клонов.

**Цены (оценки, сверить с тарифами до 6G):** дизайн голоса ≈ $0.06; сохранение и клон — входят в тариф ElevenLabs; обучение фото-аватара HeyGen ≈ $1.00; аватар без HeyGen — бесплатно. В тестовом режиме списание $0, показывается оценка live-цены.

**Политика live-медиа по областям:** `talent` — разрешено при всех условиях (enforcement есть); `generation` (картинки/видео сцен) — заблокировано до 6E.

### Staging 6C (2026-10-30 UTC)

| Шаг | Результат |
|---|---|
| Деплой | API + worker `4095a285`, web `b14cc9ea` |
| Integration 6A–6C | **18/18**, `PHASE6A_TALENT_INTEGRATION_PASS` — `phase6-talent-integration-4095a285.log` |
| Регрессия (полный 5L-B acceptance) | **`PHASE5L_B_ALL_PASS`**, `EXIT_CODE=0` — agent 2/2, regression-strict 8/8, unified 3/3, idempotency + media guard — `phase5l-b-acceptance-b14cc9ea.log` |
| Mock-политика | без изменений, $0 |

**RCA по ходу (исправлено в `b14cc9e`):** первый прогон регрессии на `4095a285` упал в unified-studio: API rate limiter отвечал 429 на запросы библиотеки, React Query прекращал повторы, а UI показывал ошибку как «Библиотека пуста»; кроме того, SSE слушал только чат. Исправлено: `ApiError` + повторы 429/5xx с учётом `Retry-After`, явное состояние ошибки с «Повторить», SSE на уровне всего рабочего пространства, инвалидация библиотеки после загрузки.

**Инфраструктура:** сборка worker зависла на `apk add` (обрыв скачивания gcc); остановлена без запуска отката (SIGKILL скрипта до `docker stop`), повторная сборка прошла. Рекомендация: вынести системные пакеты в отдельный базовый образ, чтобы деплой не зависел от зеркала Alpine.
