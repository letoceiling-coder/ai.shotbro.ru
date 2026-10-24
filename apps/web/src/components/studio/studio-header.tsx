"use client";

import { ChevronDown, Menu, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StudioSidebar } from "./studio-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useActiveProject, useStudioStore } from "@/store/studio-store";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import { useRealProjects } from "@/hooks/use-real-studio";

const panelActions = [
  { id: "files", label: "Файлы проекта" },
  { id: "script", label: "Сценарий" },
  { id: "storyboard", label: "Раскадровка" },
  { id: "first_frame", label: "Первый кадр" },
  { id: "generation", label: "Настройки генерации" },
  { id: "models", label: "Сравнение моделей" },
  { id: "result", label: "Результат" },
  { id: "versions", label: "История версий" },
  { id: "simulator", label: "Симулятор статусов" },
] as const;

export function StudioHeader({ onOpenContext }: { onOpenContext?: () => void }) {
  const { mode } = useStudioRuntimeMode();
  const project = useActiveProject();
  const activeRealProjectId = useStudioStore((s) => s.activeRealProjectId);
  const setActivePanel = useStudioStore((s) => s.setActivePanel);
  const simulatorStatus = useStudioStore((s) => s.simulatorStatus);
  const { data: realProjects } = useRealProjects();
  const [mobileNav, setMobileNav] = useState(false);

  const realTitle =
    realProjects?.items?.find((p: { id: string }) => p.id === activeRealProjectId)?.title ??
    "REAL-проект";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Проекты"
          onClick={() => setMobileNav(true)}
        >
          <Menu className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="gap-1 px-2 font-semibold">
          SHOTBRO Studio
          <ChevronDown className="size-4 opacity-60" />
        </Button>
        <Badge variant={mode === "REAL" ? "default" : "demo"} className="hidden sm:inline-flex">
          {mode}
        </Badge>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <p className="hidden truncate text-sm text-muted-foreground sm:block">
          {mode === "REAL" ? realTitle : (project?.title ?? "Проект")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {mode === "DEMO" ? (
          <Badge variant="secondary" className="hidden md:inline-flex">
            {simulatorStatus}
          </Badge>
        ) : null}
        {mode === "REAL" ? (
          <Button variant="outline" size="sm" className="gap-2 lg:hidden" onClick={() => onOpenContext?.()}>
            <SlidersHorizontal className="size-4" />
            Контекст
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Панели</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {panelActions.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => setActivePanel(item.id)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="ghost" size="icon" aria-label="Ещё">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[min(100vw,280px)] p-0">
          <StudioSidebar onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
