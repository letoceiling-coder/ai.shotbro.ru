import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProjectMemoryService } from "./project-memory.service";

export type CharacterRecord = {
  id: string;
  name: string;
  appearance?: string;
  wardrobe?: string;
  voiceNotes?: string;
  referenceAssetIds?: string[];
  sceneIds?: string[];
  version: number;
};

@Injectable()
export class CharacterContinuityService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
  ) {}

  async list(userId: string, projectId: string) {
    const mem = await this.memory.get(userId, projectId);
    return { items: (mem.characters ?? []) as CharacterRecord[] };
  }

  async upsert(
    userId: string,
    projectId: string,
    input: Omit<CharacterRecord, "id" | "version"> & { id?: string },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const mem = await this.memory.get(userId, projectId);
    const items = [...((mem.characters ?? []) as CharacterRecord[])];
    const idx = input.id ? items.findIndex((c) => c.id === input.id) : -1;
    const next: CharacterRecord = {
      id: input.id ?? uuid(),
      name: input.name,
      appearance: input.appearance,
      wardrobe: input.wardrobe,
      voiceNotes: input.voiceNotes,
      referenceAssetIds: input.referenceAssetIds ?? [],
      sceneIds: input.sceneIds ?? [],
      version: idx >= 0 ? (items[idx]!.version ?? 1) + 1 : 1,
    };
    if (idx >= 0) items[idx] = next;
    else items.push(next);
    await this.memory.patch(userId, projectId, { characters: items });
    return next;
  }
}
