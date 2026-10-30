"use client";

import { useMemo, useState } from "react";
import type { LibraryVoice, VoiceProfile } from "@shotbro/contracts";
import { Archive, AudioLines, Mic, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssetMediaUrl } from "@/hooks/use-asset-media-url";
import {
  TALENT_STATUS_LABEL,
  useArchiveTalent,
  useCreateVoice,
  useLibraryVoices,
  useVoices,
} from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";
import { cn } from "@/lib/utils";
import { WorkspaceState } from "../workspace-state";
import { ConsentBlock } from "./consent-block";
import { AssignToCharacter } from "./assign-to-character";
import { TalentFileInput, type UploadedFile } from "./talent-file-input";
import { TalentPriceCard } from "./talent-price-card";

const KIND_LABEL: Record<VoiceProfile["kind"], string> = {
  LIBRARY: "Каталог",
  CLONED: "Клон",
  DESIGNED: "По описанию",
};

const LABEL_RU: Record<string, string> = {
  male: "мужской",
  female: "женский",
  young: "молодой",
  middle_aged: "средний возраст",
  old: "пожилой",
  ru: "русский",
  en: "английский",
};

function labelsText(l: VoiceProfile["labels"] | LibraryVoice["labels"]) {
  return [l.language, l.gender, l.age].filter(Boolean).map((x) => LABEL_RU[x!] ?? x).join(" · ");
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "READY") return "default";
  if (status === "FAILED") return "destructive";
  if (status === "CREATING" || status === "AWAITING_APPROVAL") return "secondary";
  return "outline";
}

/** ▶ preview: a stored asset (design previews, saved voices) or the provider catalog URL. */
function VoicePlayer({ assetId, url, testId }: { assetId?: string | null; url?: string | null; testId?: string }) {
  const media = useAssetMediaUrl(assetId ?? undefined);
  const src = assetId ? media.data?.url : url ?? undefined;
  if (!src) {
    return <span className="text-[11px] text-muted-foreground">{assetId ? "Загрузка…" : "Без образца звучания"}</span>;
  }
  return <audio controls preload="none" src={src} className="h-8 w-full max-w-[260px]" data-testid={testId} />;
}

export function VoiceLibrary({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useVoices();
  const [tab, setTab] = useState<"mine" | "catalog">("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [q, setQ] = useState("");
  const items = useMemo(
    () => (data?.items ?? []).filter((v) => !q || v.name.toLowerCase().includes(q.toLowerCase())),
    [data?.items, q],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="voice-library">
      <header className="space-y-3 border-b border-border bg-gradient-to-b from-muted/30 to-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Голоса</h2>
            <p className="text-xs text-muted-foreground">
              Один голос можно использовать во всех проектах. Назначьте его персонажу — агент озвучит реплики этим голосом.
            </p>
          </div>
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)} data-testid="voice-create-open">
            <Plus className="mr-1 h-4 w-4" />
            Создать голос
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            {(
              [
                ["mine", "Мои голоса"],
                ["catalog", "Каталог ElevenLabs"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                data-testid={`voice-tab-${id}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "mine" ? (
            <Input className="max-w-xs" placeholder="Поиск по названию…" value={q} onChange={(e) => setQ(e.target.value)} />
          ) : null}
        </div>
      </header>

      <ScrollArea className="flex-1 p-3">
        {tab === "catalog" ? (
          <VoiceCatalog onAdded={() => setTab("mine")} />
        ) : isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <WorkspaceState
            title="Не удалось загрузить голоса"
            state="error"
            message="Сервер временно недоступен."
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Повторить
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <WorkspaceState
            title="Голосов пока нет"
            state="empty"
            message="Выберите готовый голос в каталоге ElevenLabs, клонируйте свой по записи или опишите нужный голос словами."
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setTab("catalog")}>
                  Открыть каталог
                </Button>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Создать голос
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="voice-list">
            {items.map((v) => (
              <VoiceCard key={v.id} voice={v} projectId={projectId} />
            ))}
          </ul>
        )}
      </ScrollArea>

      <CreateVoiceDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function VoiceCard({ voice: v, projectId }: { voice: VoiceProfile; projectId: string }) {
  const archive = useArchiveTalent();
  const needsConsent = v.kind === "CLONED" && !v.consent;
  const previewAssetId = v.previewAssetId ?? null;

  return (
    <li className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm" data-testid={`voice-card-${v.id}`}>
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          {v.kind === "CLONED" ? <Mic className="h-4 w-4" /> : v.kind === "DESIGNED" ? <Sparkles className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{v.name}</p>
          <p className="text-[11px] text-muted-foreground">{labelsText(v.labels) || "—"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={statusVariant(v.status)} data-testid={`voice-status-${v.id}`} data-status={v.status}>
            {TALENT_STATUS_LABEL[v.status] ?? v.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {KIND_LABEL[v.kind]}
            {v.mock ? " · тест" : ""}
          </Badge>
        </div>
      </div>

      {v.kind === "DESIGNED" && v.designPrompt ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">«{v.designPrompt}»</p>
      ) : null}

      {v.status === "READY" ? <VoicePlayer assetId={previewAssetId} url={v.previewUrl} testId={`voice-preview-${v.id}`} /> : null}

      {v.status === "FAILED" && v.lastError ? (
        <p className="text-xs text-destructive" data-testid={`voice-error-${v.id}`}>
          Не получилось: {v.lastError}. Можно запустить снова.
        </p>
      ) : null}

      {v.status === "CREATING" ? (
        <p className="text-xs text-muted-foreground">Идёт создание. Карточка обновится сама, перезагружать страницу не нужно.</p>
      ) : null}

      {/* Clone: consent first, then price → confirm. */}
      {v.kind === "CLONED" && (v.status === "DRAFT" || v.status === "FAILED") ? (
        needsConsent ? (
          <ConsentBlock projectId={projectId} kind="voice" talentId={v.id} testId={`voice-consent-${v.id}`} />
        ) : (
          <TalentPriceCard
            request={{ projectId, operation: "VOICE_CLONE", voiceProfileId: v.id }}
            actionLabel="Клонировать голос"
            testId={`voice-clone-${v.id}`}
          />
        )
      ) : null}

      {/* Design: 3 paid previews → listen → save one. */}
      {v.kind === "DESIGNED" && (v.status === "DRAFT" || v.status === "FAILED") ? (
        <div className="space-y-2">
          {v.previews.length ? (
            <div className="space-y-2" data-testid={`voice-previews-${v.id}`}>
              <p className="text-xs font-medium">Прослушайте варианты и сохраните подходящий:</p>
              {v.previews.map((p) => (
                <div key={p.generatedVoiceId} className="space-y-1 rounded-md border border-border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{p.label}</span>
                  </div>
                  <VoicePlayer assetId={p.assetId} testId={`voice-preview-option-${p.generatedVoiceId}`} />
                  <TalentPriceCard
                    request={{ projectId, operation: "VOICE_SAVE", voiceProfileId: v.id, generatedVoiceId: p.generatedVoiceId }}
                    actionLabel="Сохранить этот вариант"
                    testId={`voice-save-${p.generatedVoiceId}`}
                  />
                </div>
              ))}
            </div>
          ) : null}
          <TalentPriceCard
            request={{ projectId, operation: "VOICE_DESIGN", voiceProfileId: v.id }}
            actionLabel={v.previews.length ? "Новые 3 варианта" : "Показать 3 варианта"}
            testId={`voice-design-${v.id}`}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
        {v.status === "READY" ? <AssignToCharacter projectId={projectId} kind="voice" talentId={v.id} testId={`voice-assign-${v.id}`} /> : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={archive.isPending || v.status === "CREATING"}
          onClick={() => archive.mutate({ kind: "voice", id: v.id })}
          data-testid={`voice-archive-${v.id}`}
        >
          <Archive className="mr-1 h-4 w-4" />В архив
        </Button>
      </div>
    </li>
  );
}

function VoiceCatalog({ onAdded }: { onAdded: () => void }) {
  const { data, isLoading, isError, refetch } = useLibraryVoices();
  const create = useCreateVoice();
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError) {
    return (
      <WorkspaceState
        title="Каталог недоступен"
        state="error"
        action={
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Повторить
          </Button>
        }
      />
    );
  }

  async function add(v: LibraryVoice) {
    setError(null);
    try {
      await create.mutateAsync({
        kind: "LIBRARY",
        name: v.name,
        providerVoiceId: v.providerVoiceId,
        labels: v.labels,
        previewUrl: v.previewUrl ?? undefined,
      });
      onAdded();
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  return (
    <div className="space-y-2" data-testid="voice-catalog">
      <p className="text-xs text-muted-foreground">
        Готовые голоса ElevenLabs — бесплатно, входят в тариф.{data?.mock ? " Тестовый режим: показан демонстрационный каталог." : ""}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <ul className="grid gap-2 md:grid-cols-2">
        {(data?.items ?? []).map((v) => (
          <li
            key={v.providerVoiceId}
            className="flex flex-col gap-2 rounded-lg border border-border p-3"
            data-testid={`voice-catalog-item-${v.providerVoiceId}`}
          >
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{v.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{labelsText(v.labels)}</span>
            </div>
            <VoicePlayer url={v.previewUrl} />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={create.isPending}
              onClick={() => void add(v)}
              data-testid={`voice-catalog-add-${v.providerVoiceId}`}
            >
              Добавить в мои голоса · бесплатно
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateVoiceDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateVoice();
  const [mode, setMode] = useState<"clone" | "design">("clone");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("ru");
  const [samples, setSamples] = useState<UploadedFile[]>([]);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const promptOk = prompt.trim().length >= 20;
  const canSubmit = name.trim().length > 0 && (mode === "clone" ? samples.length > 0 : promptOk);

  function reset() {
    setName("");
    setSamples([]);
    setPrompt("");
    setError(null);
  }

  async function submit() {
    setError(null);
    try {
      if (mode === "clone") {
        await create.mutateAsync({
          kind: "CLONED",
          name: name.trim(),
          labels: { language },
          sampleAssetIds: samples.map((s) => s.assetId),
          removeBackgroundNoise: true,
        });
      } else {
        await create.mutateAsync({ kind: "DESIGNED", name: name.trim(), designPrompt: prompt.trim(), labels: { language } });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="voice-create-dialog">
        <DialogHeader>
          <DialogTitle>Новый голос</DialogTitle>
        </DialogHeader>
        <div className="flex rounded-md border border-border p-0.5">
          {(
            [
              ["clone", "Клонировать по записи"],
              ["design", "Описать словами"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              data-testid={`voice-create-mode-${id}`}
              className={cn(
                "flex-1 rounded px-2.5 py-1.5 text-xs font-medium",
                mode === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <div className="space-y-1">
              <Label htmlFor="voice-name">Название</Label>
              <Input
                id="voice-name"
                value={name}
                placeholder="Например: Голос бренда shotbro"
                onChange={(e) => setName(e.target.value)}
                data-testid="voice-create-name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="voice-lang">Язык</Label>
              <select
                id="voice-lang"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="ru">Русский</option>
                <option value="en">Английский</option>
              </select>
            </div>
          </div>

          {mode === "clone" ? (
            <div className="space-y-1.5">
              <Label>Записи голоса (1–3 файла)</Label>
              <p className="text-xs text-muted-foreground">
                Лучше всего — от 1 минуты чистой речи без музыки и шума. После создания понадобится согласие человека,
                затем вы увидите цену и подтвердите запуск.
              </p>
              <TalentFileInput
                projectId={projectId}
                accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
                max={3}
                files={samples}
                onChange={setSamples}
                label="Добавить запись"
                testId="voice-create-samples"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="voice-prompt">Каким должен быть голос</Label>
              <Textarea
                id="voice-prompt"
                rows={4}
                value={prompt}
                placeholder="Уверенный мужской голос 30–35 лет, тёплый тембр, спокойный темп, как у диктора рекламы технологий"
                onChange={(e) => setPrompt(e.target.value)}
                data-testid="voice-create-prompt"
              />
              <p className={cn("text-xs", promptOk ? "text-muted-foreground" : "text-amber-600")}>
                {prompt.trim().length}/1000 · минимум 20 символов. Затем «Показать 3 варианта» (платно, с подтверждением цены).
              </p>
            </div>
          )}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button type="button" disabled={!canSubmit || create.isPending} onClick={() => void submit()} data-testid="voice-create-submit">
            Создать черновик · бесплатно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
