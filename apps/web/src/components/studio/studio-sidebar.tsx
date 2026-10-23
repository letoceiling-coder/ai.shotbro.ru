"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  Copy,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStudioStore } from "@/store/studio-store";
import { SettingsSheet } from "./settings-sheet";

export function StudioSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useStudioStore((s) => s.sidebarCollapsed);
  const setCollapsed = useStudioStore((s) => s.setSidebarCollapsed);
  const projects = useStudioStore((s) => s.projects);
  const activeProjectId = useStudioStore((s) => s.activeProjectId);
  const setActiveProject = useStudioStore((s) => s.setActiveProject);
  const createProject = useStudioStore((s) => s.createProject);
  const renameProject = useStudioStore((s) => s.renameProject);
  const duplicateProject = useStudioStore((s) => s.duplicateProject);
  const archiveProject = useStudioStore((s) => s.archiveProject);
  const deleteProject = useStudioStore((s) => s.deleteProject);

  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (p) => !p.archived && p.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [projects, query],
  );

  return (
    <>
      <motion.aside
        layout
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-border bg-[var(--sb-sidebar)]",
          collapsed ? "w-[60px]" : "w-full max-w-[260px] sm:w-[260px]",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                SB
              </div>
              <span className="font-semibold tracking-wide">SHOTBRO</span>
            </div>
          ) : (
            <div className="mx-auto flex size-8 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              SB
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0", collapsed && "mx-auto")}
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Развернуть sidebar" : "Свернуть sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        <div className="space-y-2 px-3">
          <Button
            size="sm"
            className={cn("h-8 w-full justify-start gap-2", collapsed && "px-0")}
            onClick={() => {
              createProject();
              onNavigate?.();
            }}
          >
            <Plus className="size-4 shrink-0" />
            {!collapsed ? "Новый проект" : null}
          </Button>
          {!collapsed ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по проектам"
                className="h-8 pl-8 text-sm"
              />
            </div>
          ) : null}
        </div>

        {!collapsed ? (
          <p className="px-3 pb-0.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Проекты
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <AnimatePresence initial={false}>
            {visibleProjects.map((project) => {
              const active = project.id === activeProjectId;
              return (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-0.5"
                >
                  <div
                    className={cn(
                      "group flex items-center gap-0.5 rounded-md pr-0.5 transition-colors",
                      active
                        ? "bg-primary/12 ring-1 ring-primary/20"
                        : "hover:bg-[var(--sb-surface-hover)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProject(project.id);
                        onNavigate?.();
                      }}
                      className={cn(
                        "min-w-0 flex-1 rounded-md py-1.5 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "border-l-2 border-primary pl-[calc(0.75rem-2px)] pr-2 font-medium" : "px-3",
                        collapsed && "px-2 text-center",
                      )}
                      title={project.title}
                    >
                      {collapsed ? (
                        project.title.slice(0, 1)
                      ) : (
                        <span className="line-clamp-1">{project.title}</span>
                      )}
                    </button>
                    {!collapsed ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label="Меню проекта"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameId(project.id);
                              setRenameValue(project.title);
                            }}
                          >
                            <Pencil className="size-4" />
                            Переименовать
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateProject(project.id)}>
                            <Copy className="size-4" />
                            Дублировать
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archiveProject(project.id)}>
                            <Archive className="size-4" />
                            Архивировать
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(project.id)}
                          >
                            <Trash2 className="size-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            className={cn("w-full justify-start gap-2", collapsed && "px-0")}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
            {!collapsed ? "Настройки" : null}
          </Button>
        </div>
      </motion.aside>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать проект</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameId(null)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (renameId && renameValue.trim()) renameProject(renameId, renameValue.trim());
                setRenameId(null);
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Действие необратимо для локального DEMO-состояния в браузере.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) deleteProject(deleteId);
                setDeleteId(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
