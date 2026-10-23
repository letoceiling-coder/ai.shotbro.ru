"use client";

import Image from "next/image";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { GenerationStatusSchema, DEMO_ASSETS, type GenerationStatus } from "@shotbro/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActiveProject, useStudioStore } from "@/store/studio-store";

const panelTitles = {
  none: "",
  files: "Файлы проекта",
  script: "Сценарий",
  storyboard: "Раскадровка",
  first_frame: "Первый кадр",
  generation: "Настройки генерации",
  models: "Сравнение моделей",
  result: "Результат",
  versions: "История версий",
  simulator: "Симулятор статусов",
} as const;

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

export function ContextPanel() {
  const project = useActiveProject();
  const setActivePanel = useStudioStore((s) => s.setActivePanel);
  const simulatorStatus = useStudioStore((s) => s.simulatorStatus);
  const setSimulatorStatus = useStudioStore((s) => s.setSimulatorStatus);

  const panel = project?.activePanel ?? "none";
  const open = panel !== "none";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && setActivePanel("none")}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{panelTitles[panel] || "Панель"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <Badge variant="demo">DEMO · контекстная панель</Badge>
          {panel === "files" ? (
            <ul className="space-y-2">
              <li className="rounded-lg border border-border p-2">reference.jpg</li>
              <li className="rounded-lg border border-border p-2">script.md</li>
            </ul>
          ) : null}
          {panel === "script" ? (
            <p className="text-muted-foreground">
              Сценарий доступен в сообщении агента. Здесь будет редактор на следующих фазах.
            </p>
          ) : null}
          {panel === "storyboard" ? (
            <div className="grid grid-cols-2 gap-2">
              {[DEMO_ASSETS.storyboard1, DEMO_ASSETS.storyboard2, DEMO_ASSETS.storyboard3].map(
                (src) => (
                  <div key={src} className="relative aspect-video overflow-hidden rounded-lg">
                    <Image src={src} alt="" fill className="object-cover" sizes="160px" />
                  </div>
                ),
              )}
            </div>
          ) : null}
          {panel === "first_frame" ? (
            <div className="relative mx-auto aspect-[9/16] max-w-[220px] overflow-hidden rounded-xl">
              <Image src={DEMO_ASSETS.firstFrame} alt="" fill className="object-cover" sizes="220px" />
            </div>
          ) : null}
          {panel === "result" ? (
            <video
              controls
              className="mx-auto max-h-[420px] w-full max-w-[280px] rounded-xl"
              src={DEMO_ASSETS.video}
              poster={DEMO_ASSETS.videoPoster}
            />
          ) : null}
          {panel === "simulator" ? (
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
          ) : null}
          {panel === "models" || panel === "generation" || panel === "versions" ? (
            <p className="text-muted-foreground">
              Содержимое синхронизировано с карточками в чате для проекта «{project?.title}».
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
