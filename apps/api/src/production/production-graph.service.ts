import { Inject, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { planProductionGraph } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { agentRun, productionGraphNode, productionDocument } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { MediaQueueService } from "../queue/media-queue.service";

@Injectable()
export class ProductionGraphService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(MediaQueueService) private readonly queue: MediaQueueService,
  ) {}

  async startProductionRun(userId: string, projectId: string, runId: string) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const [run] = await this.db.select().from(agentRun).where(eq(agentRun.id, runId)).limit(1);
    if (!run || run.projectId !== projectId) throw new Error("Run not found");

    const scriptDoc = await this.db
      .select()
      .from(productionDocument)
      .where(and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "SCRIPT"), eq(productionDocument.status, "ACTIVE")))
      .limit(1);
    const storyDoc = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "STORYBOARD"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);

    const scenes = (scriptDoc[0]?.payload as { scenes?: { id: string }[] })?.scenes?.map((s) => s.id) ?? [
      "scene-1",
      "scene-2",
      "scene-3",
    ];
    const graph = planProductionGraph({
      runId,
      sceneIds: scenes,
      scriptVersion: scriptDoc[0]?.version ?? 1,
      storyboardVersion: storyDoc[0]?.version ?? 1,
    });

    const existing = await this.db
      .select()
      .from(productionGraphNode)
      .where(and(eq(productionGraphNode.projectId, projectId), eq(productionGraphNode.agentRunId, runId)))
      .limit(1);
    if (!existing[0]) {
      for (const node of graph) {
        await this.db.insert(productionGraphNode).values({
          id: node.id,
          projectId,
          agentRunId: runId,
          nodeType: node.nodeType,
          status: "QUEUED",
          dependencies: node.dependencies,
          versionHash: node.versionHash,
          inputRefs: node.sceneId ? { sceneId: node.sceneId } : {},
          providerId: "mock",
        });
      }
    }

    await this.queue.enqueueProductionRun({
      runId,
      projectId,
      ownerId: userId,
      workspaceId,
    });

    return { runId, nodeCount: graph.length, enqueued: true };
  }

  async listGraph(userId: string, projectId: string, runId?: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = runId
      ? await this.db
          .select()
          .from(productionGraphNode)
          .where(and(eq(productionGraphNode.projectId, projectId), eq(productionGraphNode.agentRunId, runId)))
      : await this.db.select().from(productionGraphNode).where(eq(productionGraphNode.projectId, projectId));
    return { items: rows };
  }
}
