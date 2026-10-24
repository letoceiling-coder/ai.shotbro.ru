export type ProjectTemplateId =
  | "general"
  | "ad_video"
  | "shorts"
  | "cartoon"
  | "images"
  | "character"
  | "photo_video"
  | "voiceover"
  | "video_edit";

export type ProjectTemplate = {
  id: ProjectTemplateId;
  title: string;
  subtitle: string;
  seedPrompt?: string;
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "general",
    title: "Универсальный AI-проект",
    subtitle: "Любая задача — опишите словами",
  },
  {
    id: "ad_video",
    title: "Рекламный ролик",
    subtitle: "15–30 сек, бренд и оффер",
    seedPrompt:
      "Создай рекламный ролик 15–20 секунд 9:16 для бренда. Нужны brief, сценарий, раскадровка и mock-производство без платных AI.",
  },
  {
    id: "shorts",
    title: "Shorts / Reels / TikTok",
    subtitle: "Вертикальное короткое видео",
    seedPrompt: "Shorts 9:16 до 30 сек: hook, 2–3 сцены, субтитры и mock-озвучка.",
  },
  {
    id: "cartoon",
    title: "AI-мультфильм",
    subtitle: "Персонажи и сцены",
    seedPrompt: "Детский мультфильм 30 сек: персонаж, 3 сцены, единый стиль, mock-генерация.",
  },
  {
    id: "images",
    title: "Генерация изображений",
    subtitle: "Серия кадров и референсы",
    seedPrompt: "Серия из 4 ключевых кадров для рекламной кампании, mock image pipeline.",
  },
  {
    id: "character",
    title: "Работа с персонажем",
    subtitle: "Continuity и референсы",
    seedPrompt: "Зафиксируй персонажа бренда и подготовь сцены с сохранением continuity.",
  },
  {
    id: "photo_video",
    title: "Видео по фотографии",
    subtitle: "Image-to-video сценарий",
    seedPrompt: "Анимация по референс-фото: план движения камеры и mock image-to-video.",
  },
  {
    id: "voiceover",
    title: "Озвучка",
    subtitle: "TTS и тайминг",
    seedPrompt: "Подготовь текст озвучки и тайминг под 20 сек ролика, mock TTS.",
  },
  {
    id: "video_edit",
    title: "Работа с видео",
    subtitle: "Монтаж и delivery",
    seedPrompt: "План монтажа существующих материалов в финальный mock MP4.",
  },
];
