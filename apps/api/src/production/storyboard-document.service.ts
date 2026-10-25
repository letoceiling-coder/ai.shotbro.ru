import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import {
  parseStoryboardDocument,
  ScriptDocumentSchema,
  StoryboardDocumentSchema,
  StoryboardSceneSchema,
  type StoryboardScene,
} from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { productionDocument } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionDocumentService } from "./production-document.service";
import { ProductionGraphService } from "./production-graph.service";

@Injectable()
export class StoryboardDocumentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProductionDocumentService) private readonly documents: ProductionDocumentService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
  ) {}

  private sceneFromScript(s: { id: string; sequence: number; title: string; description: string; durationSeconds: number; camera?: string; lighting?: string; transition?: string; characters?: string[] }): StoryboardScene {
    return StoryboardSceneSchema.parse({
      sceneId: s.id,
      order: s.sequence,
      title: s.title,
      description: s.description,
      durationSeconds: s.durationSeconds,
      cameraMotion: s.camera,
      lighting: s.lighting,
      transition: s.transition,
      characterIds: s.characters ?? [],
      revision: 1,
      status: "draft",
    });
  }

  private mergeScriptIntoScenes(scriptScenes: ReturnType<typeof ScriptDocumentSchema.parse>["scenes"], existing: StoryboardScene[]) {
    const byId = new Map(existing.map((s) => [s.sceneId, s]));
    return scriptScenes.map((s) => {
      const hit = byId.get(s.id);
      if (hit) {
        return StoryboardSceneSchema.parse({
          ...hit,
          order: s.sequence,
          title: s.title,
          durationSeconds: s.durationSeconds,
        });
      }
      return this.sceneFromScript(s);
    });
  }

  async getActive(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    try {
      const row = await this.documents.getActive(userId, projectId, "STORYBOARD");
      const parsed = parseStoryboardDocument(row.payload);
      return { ...row, payload: parsed };
    } catch {
      return null;
    }
  }

  async syncFromScript(userId: string, projectId: string) {
    const scriptRow = await this.documents.getActiveScript(userId, projectId);
    const script = ScriptDocumentSchema.parse(scriptRow.payload);
    const existing = await this.getActive(userId, projectId);
    const scenes = this.mergeScriptIntoScenes(script.scenes, existing?.payload.scenes ?? []);
    const payload = {
      schemaVersion: 2 as const,
      title: existing?.payload.title ?? script.title,
      scriptDocumentVersion: scriptRow.version,
      scenes,
    };
    if (!existing) {
      const id = uuid();
      await this.db.insert(productionDocument).values({
        id,
        projectId,
        docType: "STORYBOARD",
        version: 1,
        status: "ACTIVE",
        schemaVersion: 2,
        payload,
        createdBy: userId,
      });
      return this.getActive(userId, projectId);
    }
    return this.publishRevision(userId, projectId, existing, payload, script.scenes.map((s) => s.id));
  }

  private async publishRevision(
    userId: string,
    projectId: string,
    doc: { id: string; version: number },
    nextPayload: Record<string, unknown>,
    invalidatedSceneIds: string[],
  ) {
    await this.db
      .update(productionDocument)
      .set({ status: "SUPERSEDED", updatedAt: new Date() })
      .where(eq(productionDocument.id, doc.id));
    const newId = uuid();
    const newVersion = doc.version + 1;
    StoryboardDocumentSchema.parse(nextPayload);
    await this.db.insert(productionDocument).values({
      id: newId,
      projectId,
      docType: "STORYBOARD",
      version: newVersion,
      status: "ACTIVE",
      schemaVersion: 2,
      payload: nextPayload,
      parentDocumentId: doc.id,
      createdBy: userId,
    });
    const invalidation: { sceneId: string; invalidatedNodeIds: string[] }[] = [];
    for (const sceneId of [...new Set(invalidatedSceneIds)]) {
      const inv = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);
      invalidation.push({ sceneId, invalidatedNodeIds: inv.invalidatedNodeIds });
    }
    const active = await this.getActive(userId, projectId);
    return { ...active, invalidation };
  }

  async patchScene(
    userId: string,
    projectId: string,
    sceneId: string,
    patch: Partial<StoryboardScene> & { expectedRevision?: number },
  ) {
    const active = await this.getActive(userId, projectId);
    if (!active) throw new NotFoundException("storyboard_not_found");
    const parsed = active.payload;
    const idx = parsed.scenes.findIndex((s) => s.sceneId === sceneId);
    if (idx < 0) throw new NotFoundException("storyboard_scene_not_found");
    const current = parsed.scenes[idx]!;
    if (patch.expectedRevision != null && patch.expectedRevision !== current.revision) {
      throw new ConflictException({ code: "storyboard_scene_conflict", currentRevision: current.revision });
    }
    const { expectedRevision: _e, ...rest } = patch;
    const nextScene = StoryboardSceneSchema.parse({
      ...current,
      ...rest,
      sceneId,
      revision: current.revision + 1,
    });
    const scenes = [...parsed.scenes];
    scenes[idx] = nextScene;
    return this.publishRevision(
      userId,
      projectId,
      active,
      { ...parsed, scenes, schemaVersion: 2 },
      [sceneId],
    );
  }

  async reorderScenes(userId: string, projectId: string, sceneIds: string[]) {
    const active = await this.getActive(userId, projectId);
    if (!active) throw new NotFoundException("storyboard_not_found");
    const parsed = active.payload;
    if (sceneIds.length !== parsed.scenes.length) throw new BadRequestException("reorder_length_mismatch");
    const byId = new Map(parsed.scenes.map((s) => [s.sceneId, s]));
    const scenes = sceneIds.map((id, i) => {
      const s = byId.get(id);
      if (!s) throw new BadRequestException("unknown_scene_id");
      return { ...s, order: i + 1, revision: s.revision + 1 };
    });
    return this.publishRevision(userId, projectId, active, { ...parsed, scenes, schemaVersion: 2 }, sceneIds);
  }
}
