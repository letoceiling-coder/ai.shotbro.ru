"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_TEMPLATES, type ProjectTemplateId } from "@/lib/project-templates";
import { cn } from "@/lib/utils";

export type NewProjectCreateInput = {
  title: string;
  templateId: ProjectTemplateId;
  seedPrompt?: string;
};

type Props = {
  onCreate: (input: NewProjectCreateInput, dialog: { close: () => void }) => void;
  pending?: boolean;
};

export function NewProjectDialog({ onCreate, pending }: Props) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState<ProjectTemplateId>("general");
  const [title, setTitle] = useState("");

  const template = PROJECT_TEMPLATES.find((t) => t.id === templateId)!;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="mb-2 justify-start gap-2"
          aria-label="Создать проект"
          data-testid="real-new-project-btn"
          type="button"
        >
          <Plus className="size-4" />
          Новый проект
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="new-project-dialog">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Выберите тип задачи или оставьте универсальный — затем опишите цель в чате.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROJECT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTemplateId(t.id);
                if (!title.trim() || title === template.title) setTitle(t.title);
              }}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                templateId === t.id
                  ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                  : "border-border hover:bg-secondary/50",
              )}
            >
              <div className="font-medium">{t.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t.subtitle}</div>
            </button>
          ))}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название проекта"
          className="mt-2"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!title.trim() || pending}
            onClick={() =>
              onCreate(
                { title: title.trim(), templateId, seedPrompt: template.seedPrompt },
                { close: () => setOpen(false) },
              )
            }
          >
            {pending ? "Создаём…" : "Создать"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
