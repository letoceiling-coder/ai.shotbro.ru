"use client";

import { useMemo } from "react";
import type { QualityStrategy } from "@shotbro/contracts";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useModelCatalog } from "@/hooks/use-studio-production";

const strategyLabels: Record<QualityStrategy | "manual", string> = {
  economy: "Экономия",
  balance: "Баланс",
  quality: "Качество",
  manual: "Вручную",
};

type Props = {
  strategy: QualityStrategy | "manual";
  onStrategyChange: (s: QualityStrategy | "manual") => void;
  manualModelId?: string;
  onManualModelChange?: (modelId: string) => void;
  disabled?: boolean;
};

function groupModels(models: NonNullable<ReturnType<typeof useModelCatalog>["data"]>["models"]) {
  const llm = models.filter((m) => m.supportedOperations.includes("text"));
  const image = models.filter((m) => m.supportedOperations.some((o) => o.includes("IMAGE")));
  const video = models.filter((m) => m.supportedOperations.some((o) => o.includes("VIDEO")));
  const voice = models.filter((m) => m.supportedOperations.includes("TEXT_TO_SPEECH"));
  return { llm, image, video, voice };
}

export function ModelSelector({
  strategy,
  onStrategyChange,
  manualModelId,
  onManualModelChange,
  disabled,
}: Props) {
  const { data } = useModelCatalog();
  const groups = useMemo(() => groupModels(data?.models ?? []), [data?.models]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={strategy}
        onValueChange={(v) => onStrategyChange(v as QualityStrategy | "manual")}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Стратегия моделей">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(strategyLabels) as Array<QualityStrategy | "manual">).map((k) => (
            <SelectItem key={k} value={k}>
              {strategyLabels[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {strategy === "manual" ? (
        <Select value={manualModelId} onValueChange={onManualModelChange} disabled={disabled}>
          <SelectTrigger className="h-8 min-w-[180px] max-w-[240px] text-xs">
            <SelectValue placeholder="Модель…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {(
              [
                ["LLM", groups.llm],
                ["Изображения", groups.image],
                ["Видео", groups.video],
                ["Голос", groups.voice],
              ] as const
            ).flatMap(([label, items]) =>
              items.length
                ? [
                    <SelectItem key={`${label}-hdr`} value={`__header_${label}`} disabled>
                      — {label} —
                    </SelectItem>,
                    ...items.map((m) => (
                      <SelectItem key={m.modelId} value={m.modelId}>
                        {m.displayName} ·{" "}
                        {m.priceStatus === "UNKNOWN"
                          ? "стоимость не подтверждена"
                          : "подготовлена, live недоступен"}
                      </SelectItem>
                    )),
                  ]
                : [],
            )}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="text-[10px] font-normal">
          {strategy === "economy" && "Mock · экономичные модели"}
          {strategy === "balance" && "Mock · баланс качества"}
          {strategy === "quality" && "Mock · максимальное качество"}
        </Badge>
      )}
      {data?.liveExecutionBlocked ? (
        <Badge variant="demo" className="text-[10px]">
          Live AI заблокирован
        </Badge>
      ) : null}
    </div>
  );
}
