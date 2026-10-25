import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { CharacterProfileSchema, type CharacterProfile } from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProjectMemoryService } from "./project-memory.service";
import { ProductionGraphService } from "./production-graph.service";
@Injectable()
export class CharacterContinuityService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
  ) {}

  async list(userId: string, projectId: string) {
    const mem = await this.memory.get(userId, projectId);
    return { items: (mem.characters ?? []) as CharacterProfile[] };
  }

  async upsert(
    userId: string,
    projectId: string,
    input: Partial<CharacterProfile> & { name: string; id?: string; expectedVersion?: number },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const mem = await this.memory.get(userId, projectId);
    const items = [...((mem.characters ?? []) as CharacterProfile[])];
    const idx = input.id ? items.findIndex((c) => c.id === input.id) : -1;
    if (idx >= 0 && input.expectedVersion != null && items[idx]!.version !== input.expectedVersion) {
      throw new ConflictException({ code: "character_version_conflict", currentVersion: items[idx]!.version });
    }
    const prev = idx >= 0 ? items[idx]! : null;
    const nextVersion = prev ? prev.version + 1 : 1;
    const history = [...(prev?.history ?? [])];
    if (prev) {
      history.push({ version: prev.version, snapshot: { ...prev, history: undefined } as Record<string, unknown> });
    }
    const next = CharacterProfileSchema.parse({
      id: input.id ?? uuid(),
      name: input.name,
      description: input.description ?? prev?.description,
      appearance: input.appearance ?? prev?.appearance,
      wardrobe: input.wardrobe ?? prev?.wardrobe,
      visualStyle: input.visualStyle ?? prev?.visualStyle,
      voiceNotes: input.voiceNotes ?? prev?.voiceNotes,
      referenceAssetIds: input.referenceAssetIds ?? prev?.referenceAssetIds ?? [],
      primaryReferenceAssetId: input.primaryReferenceAssetId ?? prev?.primaryReferenceAssetId,
      sceneIds: input.sceneIds ?? prev?.sceneIds ?? [],
      version: nextVersion,
      history: history.slice(-20),
    });
    if (idx >= 0) items[idx] = next;
    else items.push(next);
    await this.memory.patch(userId, projectId, { characters: items });
    const invalidation: { sceneId: string; invalidatedNodeIds: string[] }[] = [];
    for (const sceneId of next.sceneIds ?? []) {
      const inv = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);
      invalidation.push({ sceneId, invalidatedNodeIds: inv.invalidatedNodeIds });
    }
    return { ...next, invalidation };
  }

  async restoreVersion(userId: string, projectId: string, characterId: string, version: number) {
    const mem = await this.memory.get(userId, projectId);
    const items = [...((mem.characters ?? []) as CharacterProfile[])];
    const idx = items.findIndex((c) => c.id === characterId);
    if (idx < 0) throw new NotFoundException("character_not_found");
    const current = items[idx]!;
    const snap = current.history?.find((h) => h.version === version);
    if (!snap) throw new NotFoundException("character_version_not_found");
    return this.upsert(userId, projectId, {
      ...(snap.snapshot as CharacterProfile),
      id: characterId,
      name: String(snap.snapshot.name ?? current.name),
      expectedVersion: current.version,
    });
  }

  async assignToScene(
    userId: string,
    projectId: string,
    characterId: string,
    sceneId: string,
    opts?: { characterVersion?: number },
  ) {
    const mem = await this.memory.get(userId, projectId);
    const items = [...((mem.characters ?? []) as CharacterProfile[])];
    const idx = items.findIndex((c) => c.id === characterId);
    if (idx < 0) throw new NotFoundException("character_not_found");
    const c = items[idx]!;
    if (opts?.characterVersion != null && opts.characterVersion !== c.version) {
      throw new ConflictException({ code: "character_version_mismatch", currentVersion: c.version });
    }
    const sceneIds = [...new Set([...(c.sceneIds ?? []), sceneId])];
    items[idx] = { ...c, sceneIds, version: c.version + 1 };
    await this.memory.patch(userId, projectId, { characters: items });
    const inv = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);
    return { characterId, sceneId, characterVersion: items[idx]!.version, invalidatedNodeIds: inv.invalidatedNodeIds };
  }
}
