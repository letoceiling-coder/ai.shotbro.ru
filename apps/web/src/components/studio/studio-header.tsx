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

export function StudioHeader() {
  const project = useActiveProject();
  const setActivePanel = useStudioStore((s) => s.setActivePanel);
  const simulatorStatus = useStudioStore((s) => s.simulatorStatus);
  const [mobileNav, setMobileNav] = useState(false);

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
          SHOTBRO Agent
          <ChevronDown className="size-4 opacity-60" />
        </Button>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        <p className="hidden truncate text-sm text-muted-foreground sm:block">
          {project?.title ?? "Проект"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="hidden md:inline-flex">
          {simulatorStatus}
        </Badge>
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
