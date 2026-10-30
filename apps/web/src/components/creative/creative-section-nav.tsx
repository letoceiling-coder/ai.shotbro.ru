"use client";

import { cn } from "@/lib/utils";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

type NavGroup = { id: string; label: string; items: { id: CreativeSection; label: string; hint: string }[] };

/**
 * Russian groups (spec §8; «Сцены» added in 6E). Every section keeps its own button and test id, so deep links,
 * auto-navigation and existing tests address sections directly; groups only organise them visually.
 */
export const NAV_GROUPS: NavGroup[] = [
  { id: "chat", label: "Чат", items: [{ id: "chat", label: "Чат с агентом", hint: "Агент предлагает варианты и цену" }] },
  {
    id: "script",
    label: "Сценарий",
    items: [
      { id: "brief", label: "Бриф", hint: "Цель, аудитория, формат" },
      { id: "script", label: "Сценарий", hint: "Сцены и реплики" },
      { id: "storyboard", label: "Раскадровка", hint: "Кадры по сценам" },
      { id: "prompts", label: "Промпты", hint: "Тексты для генерации кадров" },
    ],
  },
  {
    id: "scenes",
    label: "Сцены",
    items: [{ id: "canvas", label: "Холст сцен", hint: "Схема генерации: промпт → кадр → видео → монтаж" }],
  },
  {
    id: "cast",
    label: "Персонажи",
    items: [
      { id: "characters", label: "Персонажи", hint: "Персонажи проекта, их голос и аватар" },
      { id: "avatars", label: "Аватары", hint: "Аватары для всех проектов" },
      { id: "voices", label: "Голоса", hint: "Голоса для всех проектов" },
      { id: "references", label: "Референсы", hint: "Фото-образцы для персонажей и сцен" },
    ],
  },
  {
    id: "edit",
    label: "Монтаж",
    items: [
      { id: "timeline", label: "Таймлайн", hint: "Порядок клипов и звука" },
      { id: "production", label: "Сборка", hint: "Производство и итоговый ролик" },
    ],
  },
  { id: "assets", label: "Материалы", items: [{ id: "assets", label: "Материалы", hint: "Все файлы проекта" }] },
  { id: "settings", label: "Модели", items: [{ id: "models", label: "Модели и цены", hint: "Провайдеры и стоимость" }] },
];

export function sectionLabel(id: CreativeSection): string {
  for (const g of NAV_GROUPS) for (const i of g.items) if (i.id === id) return i.label;
  return id;
}

export function CreativeSectionNav() {
  const section = useStudioStore((s) => s.creativeSection);
  const setSection = useStudioStore((s) => s.setCreativeSection);

  return (
    <ScrollArea className="w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <nav className="flex items-stretch gap-1 px-2 py-1.5" data-testid="creative-section-nav" aria-label="Разделы проекта">
        {NAV_GROUPS.map((group, gi) => {
          const groupActive = group.items.some((i) => i.id === section);
          const single = group.items.length === 1;
          return (
            <div
              key={group.id}
              data-testid={`creative-group-${group.id}`}
              data-active={groupActive ? "true" : "false"}
              className={cn(
                "flex shrink-0 items-center gap-0.5 rounded-lg px-1",
                gi > 0 && "ml-1",
                !single && "border border-border/60 bg-muted/30",
              )}
            >
              {!single ? (
                <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </span>
              ) : null}
              {group.items.map(({ id, label, hint }) => (
                <button
                  key={id}
                  type="button"
                  title={hint}
                  data-testid={`creative-section-${id}`}
                  data-active={section === id ? "true" : "false"}
                  aria-current={section === id ? "page" : undefined}
                  onClick={() => setSection(id)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    section === id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {single ? group.label : label}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
