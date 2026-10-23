import type { Project } from "../project";
import type { ChatMessage } from "../blocks";

const DEMO_INTRO =
  "_Пример ответа агента (симуляция). Реальные генерации подключатся после утверждения интерфейса._";

export const DEMO_ASSETS = {
  reference: "/demo-assets/reference.jpg",
  avatarRef: "/demo-assets/avatar-ref.jpg",
  firstFrame: "/demo-assets/first-frame.jpg",
  storyboard1: "/demo-assets/storyboard-1.jpg",
  storyboard2: "/demo-assets/storyboard-2.jpg",
  storyboard3: "/demo-assets/storyboard-3.jpg",
  photoResult: "/demo-assets/photo-result.jpg",
  photoV2: "/demo-assets/photo-v2.jpg",
  avatarResult: "/demo-assets/avatar-result.jpg",
  video: "/demo-assets/shotbro-demo.mp4",
  videoPoster: "/demo-assets/video-poster.jpg",
  audio: "/demo-assets/voice-demo.mp3",
} as const;

function adProjectMessages(): ChatMessage[] {
  return [
    {
      id: "ad-u1",
      role: "user",
      createdAt: "2026-10-20T10:00:00.000Z",
      demo: true,
      attachments: [
        {
          id: "att-ref",
          name: "reference.jpg",
          mimeType: "image/jpeg",
          url: DEMO_ASSETS.reference,
          kind: "image",
          demo: true,
        },
      ],
      blocks: [
        {
          type: "text",
          markdown:
            "Создай рекламный ролик для shotbro.ru на 15 секунд. Прикрепляю фотографию парня — он должен рекламировать мой сайт.",
        },
      ],
    },
    {
      id: "ad-a1",
      role: "assistant",
      createdAt: "2026-10-20T10:00:30.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown: `${DEMO_INTRO}\n\nЯ **проанализировал задачу**. Предлагаю создать вертикальный рекламный ролик **9:16** с говорящим персонажем, сохранением внешности по референсу и финальным слоганом.`,
        },
        {
          type: "generation_plan",
          demo: true,
          title: "План генерации",
          overallStatus: "AWAITING_APPROVAL",
          steps: [
            { id: "s1", label: "Анализ референса", status: "completed" },
            { id: "s2", label: "Сценарий", status: "completed" },
            { id: "s3", label: "Первый кадр", status: "active", detail: "Ожидает утверждения" },
            { id: "s4", label: "Генерация сцен", status: "pending" },
            { id: "s5", label: "Озвучка", status: "pending" },
            { id: "s6", label: "Монтаж", status: "pending" },
            { id: "s7", label: "Финальный результат", status: "pending" },
          ],
        },
        {
          type: "script",
          demo: true,
          title: "Сценарий (15 секунд)",
          durationLabel: "15 сек",
          scenes: [
            {
              id: "sc1",
              title: "Сцена 1",
              timeRange: "0–5 сек",
              description:
                "Парень обращается в камеру и представляет SHOTBRO.",
            },
            {
              id: "sc2",
              title: "Сцена 2",
              timeRange: "5–10 сек",
              description:
                "Примеры возможностей студии: видео, реклама, изображения и мультфильмы.",
            },
            {
              id: "sc3",
              title: "Сцена 3",
              timeRange: "10–15 сек",
              description:
                "Парень приглашает на shotbro.ru и произносит: «Твоё воображение — моё воплощение».",
            },
          ],
        },
        {
          type: "cost_estimate",
          demo: true,
          title: "Оценка стоимости (DEMO)",
          disclaimer:
            "Условные единицы для демонстрации интерфейса. Реальные тарифы подключатся на этапе генераций.",
          totalLabel: "~ 48 demo credits",
          lines: [
            { label: "Анализ референса", amountLabel: "2 demo credits" },
            { label: "Сценарий и раскадровка", amountLabel: "6 demo credits" },
            { label: "Первый кадр", amountLabel: "8 demo credits" },
            { label: "Видео-сцены (3×5 сек)", amountLabel: "24 demo credits" },
            { label: "Озвучка и lip-sync", amountLabel: "6 demo credits" },
            { label: "Монтаж и экспорт", amountLabel: "2 demo credits" },
          ],
        },
        {
          type: "approval",
          demo: true,
          approvalId: "ad-script-approval",
          title: "Согласование сценария",
          description: "Утвердите сценарий, чтобы перейти к первому кадру.",
          status: "pending",
          tags: ["9:16", "15 секунд", "Русский язык"],
          actions: [
            { id: "approve", label: "Утвердить сценарий", variant: "primary" },
            { id: "edit", label: "Изменить", variant: "secondary" },
            { id: "compare", label: "Сравнить модели", variant: "ghost" },
          ],
        },
      ],
    },
  ];
}

function adProjectAfterApproval(): ChatMessage[] {
  return [
    ...adProjectMessages(),
    {
      id: "ad-u2",
      role: "user",
      createdAt: "2026-10-20T10:05:00.000Z",
      demo: true,
      blocks: [{ type: "text", markdown: "Утверждаю сценарий." }],
    },
    {
      id: "ad-a2",
      role: "assistant",
      createdAt: "2026-10-20T10:05:20.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown: `${DEMO_INTRO}\n\nСценарий утверждён. Подготовлен **первый кадр** для согласования внешности героя.`,
        },
        {
          type: "generation_plan",
          demo: true,
          title: "План генерации",
          overallStatus: "AWAITING_APPROVAL",
          steps: [
            { id: "s1", label: "Анализ референса", status: "completed" },
            { id: "s2", label: "Сценарий", status: "completed" },
            { id: "s3", label: "Первый кадр", status: "active", detail: "Готов к просмотру" },
            { id: "s4", label: "Генерация сцен", status: "pending" },
            { id: "s5", label: "Озвучка", status: "pending" },
            { id: "s6", label: "Монтаж", status: "pending" },
            { id: "s7", label: "Финальный результат", status: "pending" },
          ],
        },
        {
          type: "image_result",
          demo: true,
          title: "Первый кадр (DEMO)",
          url: DEMO_ASSETS.firstFrame,
          format: "JPEG · 9:16",
          version: 1,
          params: { lighting: "soft daylight", style: "commercial" },
        },
        {
          type: "approval",
          demo: true,
          approvalId: "ad-frame-approval",
          title: "Согласование первого кадра",
          status: "pending",
          actions: [
            { id: "approve", label: "Утвердить кадр", variant: "primary" },
            { id: "edit", label: "Изменить", variant: "secondary" },
          ],
        },
      ],
    },
  ];
}

function adProjectCompleted(): ChatMessage[] {
  return [
    ...adProjectAfterApproval(),
    {
      id: "ad-u3",
      role: "user",
      createdAt: "2026-10-20T10:10:00.000Z",
      demo: true,
      blocks: [{ type: "text", markdown: "Кадр утверждаю. Запускай демо-генерацию." }],
    },
    {
      id: "ad-a3",
      role: "assistant",
      createdAt: "2026-10-20T10:12:00.000Z",
      demo: true,
      blocks: [
        {
          type: "agent_activity",
          demo: true,
          label: "Монтаж и экспорт MP4",
          status: "COMPLETED",
          simulationLabel: "Симуляция процесса",
        },
        {
          type: "generation_plan",
          demo: true,
          title: "План генерации",
          overallStatus: "COMPLETED",
          steps: [
            { id: "s1", label: "Анализ референса", status: "completed" },
            { id: "s2", label: "Сценарий", status: "completed" },
            { id: "s3", label: "Первый кадр", status: "completed" },
            { id: "s4", label: "Генерация сцен", status: "completed" },
            { id: "s5", label: "Озвучка", status: "completed" },
            { id: "s6", label: "Монтаж", status: "completed" },
            { id: "s7", label: "Финальный результат", status: "completed" },
          ],
        },
        {
          type: "video_result",
          demo: true,
          title: "Рекламный ролик SHOTBRO (DEMO)",
          url: DEMO_ASSETS.video,
          posterUrl: DEMO_ASSETS.videoPoster,
          durationLabel: "0:15",
          aspectRatio: "9:16",
          resolution: "1080×1920",
          version: 1,
        },
      ],
    },
  ];
}

function avatarMessages(): ChatMessage[] {
  return [
    {
      id: "av-u1",
      role: "user",
      createdAt: "2026-10-18T14:00:00.000Z",
      demo: true,
      attachments: [
        {
          id: "av-att",
          name: "photos.zip",
          mimeType: "application/zip",
          url: DEMO_ASSETS.avatarRef,
          kind: "image",
          demo: true,
        },
      ],
      blocks: [
        {
          type: "text",
          markdown:
            "Нужен AI-аватар бренда по этим фото. Аватар будет говорить в рекламных роликах.",
        },
      ],
    },
    {
      id: "av-a1",
      role: "assistant",
      createdAt: "2026-10-18T14:01:00.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown: `${DEMO_INTRO}\n\nПредлагаю создать **цифрового персонажа** с сохранением черт лица и набором голосов на выбор.`,
        },
        {
          type: "image_result",
          demo: true,
          title: "Превью персонажа (DEMO)",
          url: DEMO_ASSETS.avatarResult,
          format: "PNG · 1:1",
          version: 1,
        },
        {
          type: "model_comparison",
          demo: true,
          title: "Выбор голоса (DEMO)",
          models: [
            {
              id: "voice-warm",
              name: "Тёплый барitone",
              provider: "Demo Voice A",
              quality: "Естественная дикция",
              speed: "Быстро",
              costLabel: "3 demo credits",
              recommended: true,
            },
            {
              id: "voice-energetic",
              name: "Энергичный",
              provider: "Demo Voice B",
              quality: "Рекламный тон",
              speed: "Средне",
              costLabel: "4 demo credits",
            },
          ],
          selectedId: "voice-warm",
        },
        {
          type: "audio_result",
          demo: true,
          title: "Пример озвучки (DEMO)",
          url: DEMO_ASSETS.audio,
          durationLabel: "0:08",
          voiceLabel: "Тёплый барitone",
          version: 1,
        },
        {
          type: "approval",
          demo: true,
          approvalId: "avatar-approval",
          title: "Согласование аватара",
          description: "Подтвердите образ и голос для демо-карточки результата.",
          status: "approved",
          actions: [
            { id: "approve", label: "Утвердить", variant: "primary" },
            { id: "edit", label: "Изменить", variant: "secondary" },
          ],
        },
      ],
    },
  ];
}

function cartoonMessages(): ChatMessage[] {
  return [
    {
      id: "ca-u1",
      role: "user",
      createdAt: "2026-10-15T09:00:00.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown:
            "Сделай короткий мультфильм про робота, который учится рисовать. 3 сцены, дружелюбный стиль.",
        },
      ],
    },
    {
      id: "ca-a1",
      role: "assistant",
      createdAt: "2026-10-15T09:02:00.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown: `${DEMO_INTRO}\n\nПодготовил сценарий и раскадровку. **Сцена 2** сейчас в работе (симуляция), **сцена 1** завершена.`,
        },
        {
          type: "storyboard",
          demo: true,
          title: "Раскадровка (DEMO)",
          scenes: [
            {
              id: "sb1",
              title: "Сцена 1 — Знакомство",
              thumbnailUrl: DEMO_ASSETS.storyboard1,
              status: "completed",
              durationLabel: "5 сек",
            },
            {
              id: "sb2",
              title: "Сцена 2 — Первая линия",
              thumbnailUrl: DEMO_ASSETS.storyboard2,
              status: "active",
              durationLabel: "6 сек",
            },
            {
              id: "sb3",
              title: "Сцена 3 — Финал",
              thumbnailUrl: DEMO_ASSETS.storyboard3,
              status: "pending",
              durationLabel: "5 сек",
            },
          ],
        },
        {
          type: "tool_execution",
          demo: true,
          toolId: "generate_video",
          toolName: "generate_video",
          status: "RUNNING",
          message: "Генерация сцены 2 (демо-симуляция)",
          simulationLabel: "Симуляция процесса",
        },
      ],
    },
  ];
}

function photoMessages(): ChatMessage[] {
  return [
    {
      id: "ph-u1",
      role: "user",
      createdAt: "2026-10-12T16:00:00.000Z",
      demo: true,
      attachments: [
        {
          id: "ph-ref",
          name: "reference.jpg",
          mimeType: "image/jpeg",
          url: DEMO_ASSETS.reference,
          kind: "image",
          demo: true,
        },
      ],
      blocks: [
        {
          type: "text",
          markdown:
            "Сгенерируй портрет в том же стиле, но с другой композицией — крупный план, мягкий свет.",
        },
      ],
    },
    {
      id: "ph-a1",
      role: "assistant",
      createdAt: "2026-10-12T16:02:00.000Z",
      demo: true,
      blocks: [
        {
          type: "text",
          markdown: `${DEMO_INTRO}\n\nПараметры согласованы. Ниже **демонстрационный результат** и история версий.`,
        },
        {
          type: "image_result",
          demo: true,
          title: "Портрет v2 (DEMO)",
          url: DEMO_ASSETS.photoV2,
          format: "PNG · 3:4",
          version: 2,
          params: { composition: "close-up", light: "soft" },
        },
        {
          type: "version_history",
          demo: true,
          title: "История версий",
          activeVersionId: "v2",
          items: [
            {
              id: "v1",
              version: 1,
              label: "Исходная композиция",
              createdAtLabel: "12 окт, 15:40",
              previewUrl: DEMO_ASSETS.photoResult,
            },
            {
              id: "v2",
              version: 2,
              label: "Крупный план, мягкий свет",
              createdAtLabel: "12 окт, 16:02",
              previewUrl: DEMO_ASSETS.photoV2,
            },
          ],
        },
      ],
    },
  ];
}

export type AdDemoStage = "initial" | "script_approved" | "completed";

export function getAdMessages(stage: AdDemoStage): ChatMessage[] {
  switch (stage) {
    case "initial":
      return adProjectMessages();
    case "script_approved":
      return adProjectAfterApproval();
    case "completed":
      return adProjectCompleted();
  }
}

export function createInitialDemoProjects(): Project[] {
  return [
    {
      id: "demo-ad",
      title: "SHOTBRO — реклама 15 сек",
      demo: true,
      demoScenarioId: "ad",
      archived: false,
      updatedAt: "2026-10-20T10:00:00.000Z",
      messages: adProjectMessages(),
      workflowStatus: "AWAITING_APPROVAL",
      activePanel: "none",
    },
    {
      id: "demo-avatar",
      title: "Аватар для бренда",
      demo: true,
      demoScenarioId: "avatar",
      archived: false,
      updatedAt: "2026-10-18T14:01:00.000Z",
      messages: avatarMessages(),
      workflowStatus: "COMPLETED",
      activePanel: "none",
    },
    {
      id: "demo-cartoon",
      title: "Мультфильм для клиента",
      demo: true,
      demoScenarioId: "cartoon",
      archived: false,
      updatedAt: "2026-10-15T09:02:00.000Z",
      messages: cartoonMessages(),
      workflowStatus: "RUNNING",
      activePanel: "storyboard",
    },
    {
      id: "demo-photo",
      title: "Генерация фотографий",
      demo: true,
      demoScenarioId: "photo",
      archived: false,
      updatedAt: "2026-10-12T16:02:00.000Z",
      messages: photoMessages(),
      workflowStatus: "COMPLETED",
      activePanel: "none",
    },
  ];
}
