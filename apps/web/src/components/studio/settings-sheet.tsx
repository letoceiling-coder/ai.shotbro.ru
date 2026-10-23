"use client";

import { Moon, Sun, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { GenerationStatusSchema, type GenerationStatus } from "@shotbro/contracts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useStudioStore } from "@/store/studio-store";
import { useStudioRuntimeMode } from "@/components/auth/studio-mode-provider";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const statusLabels: Record<GenerationStatus, string> = {
  DRAFT: "Черновик",
  ANALYZING: "Анализ",
  PLANNING: "Планирование",
  AWAITING_APPROVAL: "Ожидает согласования",
  QUEUED: "В очереди",
  RUNNING: "Выполняется",
  VALIDATING: "Проверка",
  COMPLETED: "Завершено",
  FAILED: "Ошибка",
  CANCELED: "Отменено",
  NEEDS_REVISION: "Нужны правки",
};

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const simulatorStatus = useStudioStore((s) => s.simulatorStatus);
  const setSimulatorStatus = useStudioStore((s) => s.setSimulatorStatus);
  const resetDemo = useStudioStore((s) => s.resetDemo);
  const { mode, setMode } = useStudioRuntimeMode();
  const session = authClient.useSession();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Настройки · DEMO</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-medium">Режим студии</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant={mode === "DEMO" ? "default" : "secondary"} size="sm" onClick={() => setMode("DEMO")}>
                DEMO
              </Button>
              <Button variant={mode === "REAL" ? "default" : "secondary"} size="sm" onClick={() => setMode("REAL")}>
                REAL
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              DEMO — локальные сценарии. REAL — серверные проекты (нужен вход).
            </p>
          </section>
          <Separator />
          <section>
            <h3 className="mb-2 text-sm font-medium">Аккаунт</h3>
            {session.data?.user ? (
              <div className="space-y-2 text-sm">
                <p>{session.data.user.email}</p>
                <Button variant="secondary" size="sm" onClick={() => authClient.signOut()}>
                  Выйти
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link href="/login">Вход</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Регистрация</Link>
                </Button>
              </div>
            )}
          </section>
          <Separator />
          <section>
            <h3 className="mb-2 text-sm font-medium">Тема</h3>
            <div className="flex gap-2">
              <Button
                variant={theme === "dark" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="size-4" />
                Тёмная
              </Button>
              <Button
                variant={theme === "light" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="size-4" />
                Светлая
              </Button>
            </div>
          </section>
          <Separator />
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-medium">Контроллер состояний</h3>
              <Badge variant="demo">Симуляция</Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Переключайте статусы для проверки UI. Без фальшивых процентов прогресса.
            </p>
            <Select
              value={simulatorStatus}
              onValueChange={(v) => setSimulatorStatus(v as GenerationStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GenerationStatusSchema.options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <Separator />
          <Button variant="outline" className="w-full" onClick={() => resetDemo()}>
            <RotateCcw className="size-4" />
            Сбросить DEMO-данные
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
