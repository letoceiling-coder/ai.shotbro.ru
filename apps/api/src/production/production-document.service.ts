import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { productionDocument } from "@shotbro/db/schema";
import { ScriptDocumentSchema, ScriptScenePayloadSchema } from "@shotbro/contracts";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionGraphService } from "./production-graph.service";

type ScriptPayload = ReturnType<typeof ScriptDocumentSchema.parse>;
type ScriptScene = ScriptPayload["scenes"][number];

@Injectable()
export class ProductionDocumentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
  ) {}

  async getActive(userId: string, projectId: string, docType: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, docType as never), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    if (!row) throw new NotFoundException();
    return row;
  }

  private recalcTotalDuration(scenes: ScriptScene[]) {
    return scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  }

  private async publishScriptRevision(
    userId: string,
    projectId: string,
    doc: { id: string; version: number; payload: unknown },
    nextPayload: ScriptPayload,
    invalidatedSceneIds: string[],
  ) {
    await this.db
      .update(productionDocument)
      .set({ status: "SUPERSEDED", updatedAt: new Date() })
      .where(eq(productionDocument.id, doc.id));
    const newId = uuid();
    const newVersion = doc.version + 1;
    await this.db.insert(productionDocument).values({
      id: newId,
      projectId,
      docType: "SCRIPT",
      version: newVersion,
      status: "ACTIVE",
      schemaVersion: 1,
      payload: nextPayload,
      parentDocumentId: doc.id,
      createdBy: userId,
    });
    const invalidation: { sceneId: string; invalidatedNodeIds: string[] }[] = [];
    for (const sceneId of [...new Set(invalidatedSceneIds)]) {
      const inv = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);
      invalidation.push({ sceneId, invalidatedNodeIds: inv.invalidatedNodeIds });
    }
    return { id: newId, version: newVersion, invalidation };
  }

  async getActiveScript(userId: string, projectId: string) {
    const row = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(row.payload);
    return { ...row, payload };
  }

  async patchScriptDocument(
    userId: string,
    projectId: string,
    patch: Partial<Omit<ScriptPayload, "scenes" | "totalDurationSeconds" | "schemaVersion">>,
  ) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse({ ...(doc.payload as object), ...patch });
    const totalDurationSeconds = this.recalcTotalDuration(payload.scenes);
    const next = ScriptDocumentSchema.parse({ ...payload, totalDurationSeconds });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, payload.scenes.map((s) => s.id));
    return { ...rev, payload: next };
  }

  async patchScriptScene(
    userId: string,
    projectId: string,
    sceneId: string,
    patch: Partial<Omit<ScriptScene, "id" | "sequence">> & { expectedRevision?: number },
  ) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(doc.payload);
    const existing = payload.scenes.find((s) => s.id === sceneId);
    if (!existing) throw new NotFoundException("scene_not_found");
    if (patch.expectedRevision != null && patch.expectedRevision !== existing.revision) {
      throw new ConflictException({ code: "scene_revision_conflict", expected: existing.revision });
    }
    const { expectedRevision: _e, ...scenePatch } = patch;
    const scenes = payload.scenes.map((s) =>
      s.id === sceneId
        ? ScriptScenePayloadSchema.parse({
            ...s,
            ...scenePatch,
            revision: (s.revision ?? 1) + 1,
          })
        : s,
    );
    const totalDurationSeconds = this.recalcTotalDuration(scenes);
    const next = ScriptDocumentSchema.parse({ ...payload, scenes, totalDurationSeconds });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, [sceneId]);
    return { ...rev, sceneId, scene: scenes.find((s) => s.id === sceneId) };
  }

  async addScriptScene(userId: string, projectId: string, input: { afterSceneId?: string; title?: string }) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(doc.payload);
    const newScene = ScriptScenePayloadSchema.parse({
      id: uuid(),
      sequence: payload.scenes.length + 1,
      title: input.title ?? `Сцена ${payload.scenes.length + 1}`,
      durationSeconds: 3,
      description: "",
    });
    let scenes = [...payload.scenes];
    if (input.afterSceneId) {
      const idx = scenes.findIndex((s) => s.id === input.afterSceneId);
      if (idx < 0) throw new NotFoundException("after_scene_not_found");
      scenes.splice(idx + 1, 0, newScene);
    } else {
      scenes.push(newScene);
    }
    scenes = scenes.map((s, i) => ({ ...s, sequence: i + 1 }));
    const totalDurationSeconds = this.recalcTotalDuration(scenes);
    const next = ScriptDocumentSchema.parse({ ...payload, scenes, totalDurationSeconds });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, [newScene.id]);
    return { ...rev, scene: newScene };
  }

  async deleteScriptScene(userId: string, projectId: string, sceneId: string) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(doc.payload);
    if (payload.scenes.length <= 1) throw new BadRequestException("cannot_delete_last_scene");
    const scenes = payload.scenes.filter((s) => s.id !== sceneId).map((s, i) => ({ ...s, sequence: i + 1 }));
    if (scenes.length === payload.scenes.length) throw new NotFoundException("scene_not_found");
    const totalDurationSeconds = this.recalcTotalDuration(scenes);
    const next = ScriptDocumentSchema.parse({ ...payload, scenes, totalDurationSeconds });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, [sceneId]);
    return { ...rev, deletedSceneId: sceneId };
  }

  async reorderScriptScenes(userId: string, projectId: string, sceneIds: string[]) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(doc.payload);
    if (sceneIds.length !== payload.scenes.length) {
      throw new BadRequestException("reorder_length_mismatch");
    }
    const byId = new Map(payload.scenes.map((s) => [s.id, s]));
    const scenes = sceneIds.map((id, i) => {
      const s = byId.get(id);
      if (!s) throw new BadRequestException("unknown_scene_id");
      return { ...s, sequence: i + 1 };
    });
    const next = ScriptDocumentSchema.parse({ ...payload, scenes });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, sceneIds);
    return { ...rev, sceneIds };
  }

  async duplicateScriptScene(userId: string, projectId: string, sceneId: string) {
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse(doc.payload);
    const source = payload.scenes.find((s) => s.id === sceneId);
    if (!source) throw new NotFoundException("scene_not_found");
    const copy = ScriptScenePayloadSchema.parse({
      ...source,
      id: uuid(),
      title: `${source.title} (копия)`,
      revision: 1,
    });
    const idx = payload.scenes.findIndex((s) => s.id === sceneId);
    const scenes = [...payload.scenes];
    scenes.splice(idx + 1, 0, copy);
    const normalized = scenes.map((s, i) => ({ ...s, sequence: i + 1 }));
    const totalDurationSeconds = this.recalcTotalDuration(normalized);
    const next = ScriptDocumentSchema.parse({ ...payload, scenes: normalized, totalDurationSeconds });
    const rev = await this.publishScriptRevision(userId, projectId, doc, next, [copy.id, sceneId]);
    return { ...rev, scene: copy };
  }
}
