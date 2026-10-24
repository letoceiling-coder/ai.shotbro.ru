import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import { and, eq } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { productionDocument } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionGraphService } from "./production-graph.service";

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

  async patchScriptScene(
    userId: string,
    projectId: string,
    sceneId: string,
    patch: { description?: string; durationSeconds?: number },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const doc = await this.getActive(userId, projectId, "SCRIPT");
    const payload = doc.payload as {
      scenes: Array<{ id: string; description: string; durationSeconds: number; title: string; sequence: number }>;
    };
    const scenes = payload.scenes.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            description: patch.description ?? s.description,
            durationSeconds: patch.durationSeconds ?? s.durationSeconds,
          }
        : s,
    );
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
      payload: { ...payload, scenes, mock: true },
      parentDocumentId: doc.id,
      createdBy: userId,
    });

    const invalidation = await this.graph.invalidateSceneAcrossActiveRuns(userId, projectId, sceneId);

    return { id: newId, version: newVersion, sceneId, invalidation };
  }
}
