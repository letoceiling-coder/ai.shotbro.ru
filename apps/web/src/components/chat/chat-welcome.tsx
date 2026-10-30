"use client";

import { Clapperboard, FileText, Mic, Sparkles, UserRound, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudioStore, type CreativeSection } from "@/store/studio-store";

/** Ready-made requests: the agent proposes options and a price; paid steps run only after «Подтвердить». */
export const CHAT_QUICK_PROMPTS = [
  {
    id: "script",
    icon: FileText,
    label: "Написать сценарий",
    text: "Напиши сценарий рекламного ролика для сайта shotbro.ru: 3 сцены по 5 секунд, вертикальное видео, дружелюбный тон.",
  },
  {
    id: "voice",
    icon: Mic,
    label: "Подобрать голос",
    text: "Подбери голос для ведущего: русский язык, уверенный и дружелюбный. Предложи 2–3 варианта с ценой.",
  },
  {
    id: "canvas",
    icon: Clapperboard,
    label: "Собрать ролик на холсте",
    text: "Собери ролик на холсте из всех сцен и покажи цену.",
  },
] as const;

const STEPS: Array<{ n: number; title: string; text: string; section: CreativeSection; icon: typeof FileText }> = [
  { n: 1, title: "Сценарий", text: "Опишите идею — агент напишет сценарий и раскадровку", section: "script", icon: FileText },
  { n: 2, title: "Голос и аватар", text: "Выберите или запишите голос, создайте аватар из фото", section: "voices", icon: UserRound },
  { n: 3, title: "Сцены", text: "Кадры, видео сцен и монтаж — на холсте, с ценой до запуска", section: "canvas", icon: Clapperboard },
  { n: 4, title: "Готовый ролик", text: "MP4 придёт сюда, в чат", section: "assets", icon: Sparkles },
];

export function ChatWelcome({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const setSection = useStudioStore((s) => s.setCreativeSection);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-8 text-center" data-testid="chat-welcome">
      <Sparkles className="mb-3 size-8 text-primary" />
      <h1 className="text-xl font-semibold">Студия рекламных роликов</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Напишите, какой ролик нужен, — агент предложит варианты и покажет цену. Платные действия запускаются только после
        вашего подтверждения.
      </p>

      <ol className="mt-6 grid w-full gap-2 text-left sm:grid-cols-2">
        {STEPS.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              onClick={() => setSection(s.section)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50"
              data-testid={`chat-welcome-step-${s.section}`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">Начните с готовой просьбы</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {CHAT_QUICK_PROMPTS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onSend(p.text)}
            title={p.text}
            data-testid={`chat-quick-${p.id}`}
          >
            <p.icon className="mr-1 h-3.5 w-3.5" />
            {p.label}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setSection("avatars")} data-testid="chat-quick-avatar">
          <Wand2 className="mr-1 h-3.5 w-3.5" />
          Создать аватар из фото
        </Button>
      </div>
    </div>
  );
}
