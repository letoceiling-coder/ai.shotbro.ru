import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { promptVersion } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";

@Injectable()
export class PromptVersionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
  ) {}

  hashPrompt(text: string, modelId?: string) {
    return createHash("sha256").update(`${modelId ?? ""}|${text}`).digest("hex");
  }

  async listForScene(userId: string, projectId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.projectId, projectId), eq(promptVersion.targetId, sceneId)))
      .orderBy(desc(promptVersion.version));
    return { items: rows };
  }

  async create(
    userId: string,
    projectId: string,
    input: { sceneId: string; modelId?: string; renderedPrompt: string; parameters?: Record<string, unknown> },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [latest] = await this.db
      .select()
      .from(promptVersion)
      .where(and(eq(promptVersion.projectId, projectId), eq(promptVersion.targetId, input.sceneId)))
      .orderBy(desc(promptVersion.version))
      .limit(1);
    const version = (latest?.version ?? 0) + 1;
    const id = uuid();
    await this.db.insert(promptVersion).values({
      id,
      projectId,
      targetType: "SCENE",
      targetId: input.sceneId,
      version,
      modelId: input.modelId ?? "mock",
      renderedPrompt: input.renderedPrompt,
      parameters: { ...input.parameters, promptHash: this.hashPrompt(input.renderedPrompt, input.modelId) },
      approvalState: "DRAFT",
      createdBy: userId,
    });
    const [row] = await this.db.select().from(promptVersion).where(eq(promptVersion.id, id)).limit(1);
    return row!;
  }

  async getLatest(userId: string, projectId: string, sceneId: string) {
    const { items } = await this.listForScene(userId, projectId, sceneId);
    if (!items[0]) throw new NotFoundException("No prompt version");
    return items[0];
  }
}
