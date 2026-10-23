import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { planProductionGraph, type GraphNodePlan } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { productionGraphNode } from "@shotbro/db/schema";
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

  async persistGraph(userId: string, projectId: string, runId: string, plan: GraphNodePlan[]) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    for (const node of plan) {
      await this.db.insert(productionGraphNode).values({
        id: node.id,
        projectId,
        agentRunId: runId,
        nodeType: node.nodeType,
        status: "QUEUED",
        dependencies: node.dependencies,
        versionHash: node.versionHash,
        inputRefs: node.sceneId ? { sceneId: node.sceneId } : {},
      });
    }
    return { nodeCount: plan.length };
  }

  async enqueueRunnable(projectId: string, runId: string, sceneIds: string[], scriptVersion: number, storyboardVersion: number) {
    const graph = planProductionGraph({ runId, sceneIds, scriptVersion, storyboardVersion });
    for (const node of graph) {
      if (node.nodeType === "IMAGE_GENERATION" || node.nodeType === "VIDEO_GENERATION" || node.nodeType === "ASSEMBLY") {
        await this.queue.enqueueProductionNode(node.id, projectId, runId, node.nodeType);
      }
    }
  }

  async listGraph(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db.select().from(productionGraphNode).where(eq(productionGraphNode.projectId, projectId));
    return { items: rows };
  }
}
