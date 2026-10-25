import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { ModelParameterValidator } from "@shotbro/ai";
import {
  ScenePromptBundleSchema,
  type ScenePromptBundle,
  SaveScenePromptBodySchema,
} from "@shotbro/contracts";
import type { Db } from "@shotbro/db/client";
import { promptVersion } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";

const BUNDLE_KEY = "scenePromptBundle";

@Injectable()
export class PromptVersionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
  ) {}

  hashPrompt(text: string, modelId?: string) {
    return createHash("sha256").update(`${modelId ?? ""}|${text}`).digest("hex");
  }

  bundleFromRow(row: typeof promptVersion.$inferSelect): ScenePromptBundle | null {
    const raw = row.parameters?.[BUNDLE_KEY];
    if (!raw) return null;
    const parsed = ScenePromptBundleSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async listForScene(userId: string, projectId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.projectId, projectId), eq(promptVersion.targetId, sceneId)))
      .orderBy(desc(promptVersion.version));
    return {
      items: rows.map((r) => ({
        ...r,
        bundle: this.bundleFromRow(r),
      })),
    };
  }

  async getByVersion(userId: string, projectId: string, sceneId: string, version: number) {
    const { items } = await this.listForScene(userId, projectId, sceneId);
    const hit = items.find((i) => i.version === version);
    if (!hit) throw new NotFoundException("Prompt version not found");
    return hit;
  }

  async getLatest(userId: string, projectId: string, sceneId: string) {
    const { items } = await this.listForScene(userId, projectId, sceneId);
    if (!items[0]) throw new NotFoundException("No prompt version");
    return items[0];
  }

  async saveScenePrompt(
    userId: string,
    projectId: string,
    sceneId: string,
    body: unknown,
  ) {
    const parsed = SaveScenePromptBodySchema.parse(body);
    return this.createVersion(userId, projectId, sceneId, parsed.bundle, parsed.changeNote);
  }

  /** Legacy: single renderedPrompt string */
  async create(
    userId: string,
    projectId: string,
    input: { sceneId: string; modelId?: string; renderedPrompt: string; parameters?: Record<string, unknown> },
  ) {
    const bundle = ScenePromptBundleSchema.parse({
      image: { prompt: input.renderedPrompt },
      video: {},
      imageModelId: input.modelId ?? "mock/image",
      videoModelId: "mock/video",
      modelParameters: input.parameters as ScenePromptBundle["modelParameters"],
    });
    return this.createVersion(userId, projectId, input.sceneId, bundle);
  }

  private async createVersion(
    userId: string,
    projectId: string,
    sceneId: string,
    bundle: ScenePromptBundle,
    changeNote?: string,
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as { sceneModelSettings?: Record<string, unknown> };
    const settingsSnapshot = prefs.sceneModelSettings?.[sceneId] ?? null;

    const [latest] = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.projectId, projectId), eq(promptVersion.targetId, sceneId)))
      .orderBy(desc(promptVersion.version))
      .limit(1);
    const version = (latest?.version ?? 0) + 1;
    const id = uuid();
    const renderedPrompt = bundle.image.prompt;
    const parameters: Record<string, unknown> = {
      [BUNDLE_KEY]: bundle,
      promptHash: this.hashPrompt(renderedPrompt, bundle.imageModelId),
      settingsSnapshot,
      changeNote: changeNote ?? null,
    };

    await this.db.insert(promptVersion).values({
      id,
      projectId,
      targetType: "SCENE",
      targetId: sceneId,
      version,
      modelId: bundle.imageModelId,
      renderedPrompt,
      parameters,
      approvalState: "DRAFT",
      createdBy: userId,
    });
    const [row] = await this.db.select().from(promptVersion).where(eq(promptVersion.id, id)).limit(1);
    const invalidation = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);
    return { ...row!, bundle, invalidation };
  }

  async restoreVersion(userId: string, projectId: string, sceneId: string, fromVersion: number) {
    const source = await this.getByVersion(userId, projectId, sceneId, fromVersion);
    const bundle = source.bundle;
    if (!bundle) throw new BadRequestException("Version has no structured prompt bundle");
    return this.createVersion(userId, projectId, sceneId, {
      ...bundle,
      restoredFromVersion: fromVersion,
    }, `restore:v${fromVersion}`);
  }

  async compareVersions(
    userId: string,
    projectId: string,
    sceneId: string,
    versionA: number,
    versionB: number,
  ) {
    const a = await this.getByVersion(userId, projectId, sceneId, versionA);
    const b = await this.getByVersion(userId, projectId, sceneId, versionB);
    const diffs: Array<{ path: string; a: unknown; b: unknown }> = [];
    const walk = (prefix: string, va: unknown, vb: unknown) => {
      if (JSON.stringify(va) === JSON.stringify(vb)) return;
      if (typeof va !== "object" || va === null || typeof vb !== "object" || vb === null) {
        diffs.push({ path: prefix, a: va, b: vb });
        return;
      }
      const keys = new Set([...Object.keys(va as object), ...Object.keys(vb as object)]);
      for (const k of keys) {
        walk(prefix ? `${prefix}.${k}` : k, (va as Record<string, unknown>)[k], (vb as Record<string, unknown>)[k]);
      }
    };
    walk("image", a.bundle?.image ?? {}, b.bundle?.image ?? {});
    walk("video", a.bundle?.video ?? {}, b.bundle?.video ?? {});
    return { versionA, versionB, diffs, bundleA: a.bundle, bundleB: b.bundle };
  }

  async validateForModel(
    userId: string,
    projectId: string,
    sceneId: string,
    input: { modelId: string; operation: string; parameters?: Record<string, unknown> },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const validator = new ModelParameterValidator();
    const params = input.parameters ?? {};
    const check = validator.validate(input.modelId, input.operation, params);
    return { sceneId, ...check, mockOnly: true };
  }

  async getSceneModelSettingsSnapshot(userId: string, projectId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as { sceneModelSettings?: Record<string, unknown> };
    return prefs.sceneModelSettings?.[sceneId] ?? null;
  }
}
