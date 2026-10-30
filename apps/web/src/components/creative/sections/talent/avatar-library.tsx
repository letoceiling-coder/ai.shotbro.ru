"use client";

import { useState } from "react";
import type { AvatarProfile } from "@shotbro/contracts";
import { Archive, Info, Plus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssetMediaUrl } from "@/hooks/use-asset-media-url";
import {
  TALENT_STATUS_LABEL,
  useArchiveTalent,
  useAvatars,
  useCreateAvatar,
  useProviderChain,
  useUpdateAvatar,
  useVoices,
} from "@/hooks/use-talent";
import { talentErrorMessage } from "@/lib/talent-errors";
import { cn } from "@/lib/utils";
import { WorkspaceState } from "../workspace-state";
import { AssignToCharacter } from "./assign-to-character";
import { ConsentBlock } from "./consent-block";
import { TalentFileInput, type UploadedFile } from "./talent-file-input";
import { TalentPriceCard } from "./talent-price-card";
import { statusVariant } from "./voice-library";

const PROVIDER_LABEL: Record<string, string> = { heygen: "HeyGen", fal: "Fal", openrouter: "OpenRouter" };

function Photo({ assetId, className, alt }: { assetId?: string | null; className?: string; alt?: string }) {
  const { data } = useAssetMediaUrl(assetId ?? undefined);
  if (!data?.url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <UserRound className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={data.url} alt={alt ?? ""} className={cn("object-cover", className)} />;
}

function ProviderChainNote() {
  const { data } = useProviderChain("AVATAR_TRAIN");
  if (!data) return null;
  const selected = data.chain.find((c) => c.providerId === data.selected);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs" data-testid="avatar-provider-chain">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="space-y-0.5">
        <p>
          Сейчас аватары создаются через{" "}
          <span className="font-semibold" data-testid="avatar-provider-selected">
            {data.selected ? PROVIDER_LABEL[data.selected] : "—"}
          </span>
          {data.mockMode ? " (тестовый режим, списание $0)" : ""}.
        </p>
        <p className="text-muted-foreground">
          {selected?.persistentIdentity
            ? "HeyGen обучает постоянный фото-аватар: одно и то же лицо в каждом видео."
            : "Без ключа HeyGen фото становятся образами-референсами для видео (бесплатно, без обучения). Порядок: HeyGen → Fal → OpenRouter."}
        </p>
      </div>
    </div>
  );
}

export function AvatarLibrary({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useAvatars();
  const [createOpen, setCreateOpen] = useState(false);
  const items = data?.items ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="avatar-library">
      <header className="space-y-3 border-b border-border bg-gradient-to-b from-muted/30 to-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Аватары</h2>
            <p className="text-xs text-muted-foreground">
              Аватар — лицо персонажа, которое повторяется во всех роликах. Создайте один раз и используйте в любых проектах.
            </p>
          </div>
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)} data-testid="avatar-create-open">
            <Plus className="mr-1 h-4 w-4" />
            Создать аватар
          </Button>
        </div>
        <ProviderChainNote />
      </header>

      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <WorkspaceState
            title="Не удалось загрузить аватары"
            state="error"
            action={
              <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                Повторить
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <WorkspaceState
            title="Аватаров пока нет"
            state="empty"
            message="Загрузите 1–10 фото человека (анфас, хороший свет), выберите голос по умолчанию — и аватар готов к использованию."
            action={
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Создать аватар
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="avatar-list">
            {items.map((a) => (
              <AvatarCard key={a.id} avatar={a} projectId={projectId} />
            ))}
          </ul>
        )}
      </ScrollArea>

      <CreateAvatarDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function AvatarCard({ avatar: a, projectId }: { avatar: AvatarProfile; projectId: string }) {
  const archive = useArchiveTalent();
  const update = useUpdateAvatar();
  const { data: voices } = useVoices();
  const readyVoices = (voices?.items ?? []).filter((v) => v.status === "READY");
  const defaultLook = a.looks.find((l) => l.isDefault) ?? a.looks[0];
  const [lookId, setLookId] = useState<string | null>(defaultLook?.id ?? null);
  const cover = defaultLook?.previewAssetId ?? a.sourceAssetIds[0];
  const isPhoto = a.kind === "PHOTO";
  const canStart = a.status === "DRAFT" || a.status === "FAILED";

  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" data-testid={`avatar-card-${a.id}`}>
      <div className="flex gap-3 p-3">
        <Photo assetId={cover} className="h-20 w-20 shrink-0 rounded-lg" alt={a.name} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{a.name}</p>
            <Badge variant={statusVariant(a.status)} className="ml-auto" data-testid={`avatar-status-${a.id}`} data-status={a.status}>
              {TALENT_STATUS_LABEL[a.status] ?? a.status}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {isPhoto ? "Фото-аватар HeyGen" : "Образы-референсы"}
            {a.provider ? ` · ${PROVIDER_LABEL[a.provider] ?? a.provider}` : ""}
            {a.mock ? " · тест" : ""} · фото: {a.sourceAssetIds.length}
          </p>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            Голос:
            <select
              className="h-7 max-w-[170px] rounded-md border border-input bg-background px-1.5 text-[11px] text-foreground"
              value={a.defaultVoiceProfileId ?? ""}
              onChange={(e) => update.mutate({ id: a.id, defaultVoiceProfileId: e.target.value || null })}
              data-testid={`avatar-voice-${a.id}`}
            >
              <option value="">не выбран</option>
              {readyVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {a.looks.length ? (
        <div className="space-y-1 px-3 pb-2">
          <p className="text-[11px] font-medium text-muted-foreground">Образы — выберите, какой использовать:</p>
          <div className="flex flex-wrap gap-1.5" data-testid={`avatar-looks-${a.id}`}>
            {a.looks.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLookId(l.id)}
                title={l.label}
                data-testid={`avatar-look-${l.id}`}
                className={cn(
                  "overflow-hidden rounded-md border-2",
                  lookId === l.id ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                )}
              >
                <Photo assetId={l.previewAssetId} className="h-12 w-12" alt={l.label} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 border-t border-border p-3">
        {a.status === "CREATING" ? (
          <p className="text-xs text-muted-foreground">Идёт обучение аватара. Статус обновится сам.</p>
        ) : null}
        {a.status === "FAILED" ? (
          <p className="text-xs text-destructive">Не получилось создать аватар. Можно запустить снова.</p>
        ) : null}
        {canStart ? (
          isPhoto && !a.consent ? (
            <ConsentBlock projectId={projectId} kind="avatar" talentId={a.id} testId={`avatar-consent-${a.id}`} />
          ) : (
            <TalentPriceCard
              request={{ projectId, operation: "AVATAR_TRAIN", avatarProfileId: a.id }}
              actionLabel={isPhoto ? "Обучить аватар" : "Подготовить образы"}
              testId={`avatar-train-${a.id}`}
            />
          )
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {a.status === "READY" ? (
            <AssignToCharacter projectId={projectId} kind="avatar" talentId={a.id} lookId={lookId} testId={`avatar-assign-${a.id}`} />
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            disabled={archive.isPending || a.status === "CREATING"}
            onClick={() => archive.mutate({ kind: "avatar", id: a.id })}
            data-testid={`avatar-archive-${a.id}`}
          >
            <Archive className="mr-1 h-4 w-4" />В архив
          </Button>
        </div>
      </div>
    </li>
  );
}

function CreateAvatarDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const create = useCreateAvatar();
  const { data: voices } = useVoices();
  const readyVoices = (voices?.items ?? []).filter((v) => v.status === "READY");
  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<UploadedFile[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        sourceAssetIds: photos.map((p) => p.assetId),
        defaultVoiceProfileId: voiceId || undefined,
      });
      setName("");
      setPhotos([]);
      setVoiceId("");
      onOpenChange(false);
    } catch (e) {
      setError(talentErrorMessage(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="avatar-create-dialog">
        <DialogHeader>
          <DialogTitle>Новый аватар</DialogTitle>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="space-y-1.5">
            <Label htmlFor="avatar-name">1. Имя</Label>
            <Input
              id="avatar-name"
              value={name}
              placeholder="Например: Ведущий shotbro"
              onChange={(e) => setName(e.target.value)}
              data-testid="avatar-create-name"
            />
          </li>
          <li className="space-y-1.5">
            <Label>2. Фото (1–10)</Label>
            <p className="text-xs text-muted-foreground">Лицо крупно, анфас, ровный свет, без очков и посторонних людей.</p>
            <TalentFileInput
              projectId={projectId}
              accept="image/jpeg,image/png,image/webp"
              max={10}
              files={photos}
              onChange={setPhotos}
              label="Добавить фото"
              testId="avatar-create-photos"
            />
          </li>
          <li className="space-y-1.5">
            <Label htmlFor="avatar-voice">3. Голос по умолчанию (можно позже)</Label>
            <select
              id="avatar-voice"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              data-testid="avatar-create-voice"
            >
              <option value="">Без голоса</option>
              {readyVoices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </li>
          <li className="text-xs text-muted-foreground">
            4. После создания черновика в карточке появятся цена и кнопка «Подтвердить». Для фото-аватара HeyGen сначала
            понадобится согласие человека.
          </li>
        </ol>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!name.trim() || !photos.length || create.isPending}
            onClick={() => void submit()}
            data-testid="avatar-create-submit"
          >
            Создать черновик · бесплатно
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
