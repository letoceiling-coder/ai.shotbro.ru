import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { ReferenceLinkSchema, type ReferenceLink } from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { AssetsService } from "../assets/assets.service";
import { ProjectMemoryService } from "./project-memory.service";
import { ProductionGraphService } from "./production-graph.service";

const LINKS_KEY = "referenceLinks";

@Injectable()
export class ReferenceService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
    @Inject(AssetsService) private readonly assets: AssetsService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
  ) {}

  private readLinks(prefs: Record<string, unknown>): ReferenceLink[] {
    const raw = prefs[LINKS_KEY];
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => ReferenceLinkSchema.parse(r));
  }

  async list(userId: string, projectId: string, filter?: { sceneId?: string; characterId?: string }) {
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as Record<string, unknown>;
    let items = this.readLinks(prefs);
    if (filter?.sceneId) items = items.filter((l) => l.sceneId === filter.sceneId);
    if (filter?.characterId) items = items.filter((l) => l.characterId === filter.characterId);
    return { items };
  }

  private async assertAssetInProject(userId: string, projectId: string, assetId: string) {
    const list = await this.assets.listForProject(userId, projectId);
    const hit = list.find((a) => a.id === assetId);
    if (!hit) throw new NotFoundException("asset_not_in_project");
    return hit;
  }

  async attach(
    userId: string,
    projectId: string,
    input: {
      assetId: string;
      role: ReferenceLink["role"];
      sceneId?: string;
      characterId?: string;
      idempotencyKey?: string;
    },
  ) {
    await this.assertAssetInProject(userId, projectId, input.assetId);
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as Record<string, unknown>;
    const items = this.readLinks(prefs);
    if (input.idempotencyKey) {
      const dup = items.find((l) => (l as ReferenceLink & { idempotencyKey?: string }).id === input.idempotencyKey);
      if (dup) return { link: dup, duplicate: true };
    }
    const link = ReferenceLinkSchema.parse({
      id: uuid(),
      projectId,
      assetId: input.assetId,
      role: input.role,
      sceneId: input.sceneId,
      characterId: input.characterId,
      revision: 1,
      createdAt: new Date().toISOString(),
    });
    items.push(link);
    await this.memory.patch(userId, projectId, { preferences: { ...prefs, [LINKS_KEY]: items } });
    if (input.sceneId) {
      await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, input.sceneId);
    }
    return { link, duplicate: false };
  }

  async detach(userId: string, projectId: string, linkId: string) {
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as Record<string, unknown>;
    const items = this.readLinks(prefs);
    const hit = items.find((l) => l.id === linkId);
    if (!hit) throw new NotFoundException("reference_link_not_found");
    const next = items.filter((l) => l.id !== linkId);
    await this.memory.patch(userId, projectId, { preferences: { ...prefs, [LINKS_KEY]: next } });
    if (hit.sceneId) {
      await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, hit.sceneId);
    }
    return { detached: linkId };
  }

  async updateRole(userId: string, projectId: string, linkId: string, role: ReferenceLink["role"]) {
    if (!ReferenceLinkSchema.shape.role.safeParse(role).success) throw new BadRequestException("invalid_role");
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as Record<string, unknown>;
    const items = this.readLinks(prefs);
    const idx = items.findIndex((l) => l.id === linkId);
    if (idx < 0) throw new NotFoundException("reference_link_not_found");
    const updated = ReferenceLinkSchema.parse({ ...items[idx], role, revision: items[idx]!.revision + 1 });
    items[idx] = updated;
    await this.memory.patch(userId, projectId, { preferences: { ...prefs, [LINKS_KEY]: items } });
    return { link: updated };
  }
}
