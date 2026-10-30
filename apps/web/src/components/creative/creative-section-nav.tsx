"use client";

import { cn } from "@/lib/utils";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, left: false, right: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const updateEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({
      overflow: el.scrollWidth > el.clientWidth + 2,
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  // Mouse wheel scrolls the menu sideways (non-passive listener so the page itself does not scroll).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      el.scrollBy({ left: delta, behavior: "auto" });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    updateEdges();
    return () => {
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [updateEdges]);

  // Keep the selected section visible (e.g. after the agent opens «Голоса» or a deep link).
  useEffect(() => {
    const btn = scroller.current?.querySelector<HTMLElement>(`[data-testid="creative-section-${section}"]`);
    btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [section]);

  const page = (dir: -1 | 1) => scroller.current?.scrollBy({ left: dir * Math.max(200, (scroller.current?.clientWidth ?? 400) * 0.6), behavior: "smooth" });

  return (
    <div className="flex w-full items-stretch border-b border-border bg-background/80 backdrop-blur-sm">
      {edges.overflow ? (
        <button
          type="button"
          aria-label="Прокрутить разделы влево"
          title="Прокрутить влево (или колесо мыши)"
          disabled={!edges.left}
          onClick={() => page(-1)}
          data-testid="creative-nav-left"
          className="flex w-7 shrink-0 items-center justify-center border-r border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}
      <div
        ref={scroller}
        onScroll={updateEdges}
        className="min-w-0 flex-1 cursor-grab overflow-x-auto overscroll-x-contain active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-testid="creative-nav-scroller"
        // Drag with the mouse to scroll (a click without movement still selects the section).
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || e.button !== 0) return;
          drag.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !scroller.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 5) d.moved = true;
          if (d.moved) scroller.current.scrollLeft = d.left - dx;
        }}
        onPointerUp={() => {
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
      <nav className="flex w-max items-stretch gap-1 px-2 py-1.5" data-testid="creative-section-nav" aria-label="Разделы проекта">
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
      </div>
      {edges.overflow ? (
        <button
          type="button"
          aria-label="Прокрутить разделы вправо"
          title="Прокрутить вправо (или колесо мыши)"
          disabled={!edges.right}
          onClick={() => page(1)}
          data-testid="creative-nav-right"
          className="flex w-7 shrink-0 items-center justify-center border-l border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
