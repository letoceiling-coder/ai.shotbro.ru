"use client";

import type { StoryboardBlockSchema } from "@shotbro/contracts";
import type { z } from "zod";
import { SceneCard } from "./scene-card";
import { StudioBlockCard, StudioBlockCardBody, StudioBlockCardHeader } from "../studio-block-card";

type Block = z.infer<typeof StoryboardBlockSchema>;

export function StoryboardViewer({ block }: { block: Block }) {
  return (
    <StudioBlockCard>
      <StudioBlockCardHeader title={block.title} />
      <StudioBlockCardBody>
        <div className="grid gap-2 sm:grid-cols-2">
          {block.scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} />
          ))}
        </div>
      </StudioBlockCardBody>
    </StudioBlockCard>
  );
}
