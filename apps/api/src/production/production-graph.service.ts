import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { invalidateSceneDependents, planProductionGraph, type SceneVersionRefs } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { agentRun, productionGraphNode, productionDocument, promptVersion, projectMemory } from "@shotbro/db/schema";
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

    const { graph, scenes } = await this.buildGraphPlan(projectId, runId);

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

    const enqueued = await this.queue.enqueueProductionRun({
      runId,
      projectId,
      ownerId: userId,
      workspaceId,
    });

    return { runId, nodeCount: graph.length, sceneCount: scenes.length, enqueued };
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

  /** Re-queue only DAG nodes that depend on a changed scene (mock — no paid regeneration). */
  async invalidateSceneAcrossActiveRuns(userId: string, projectId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const runs = await this.db
      .select()
      .from(agentRun)
      .where(and(eq(agentRun.projectId, projectId)));
    const touched: string[] = [];
    for (const run of runs) {
      if (run.status === "COMPLETED" || run.productionState === "CANCELLED") continue;
      const n = await this.invalidateSceneForRun(userId, projectId, run.id, sceneId);
      touched.push(...n.invalidatedNodeIds);
    }
    return { sceneId, invalidatedNodeIds: [...new Set(touched)] };
  }

  async invalidateSceneForRun(userId: string, projectId: string, runId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const { graph } = await this.buildGraphPlan(projectId, runId);
    const staleIds = invalidateSceneDependents(graph, sceneId, runId);
    if (!staleIds.length) return { runId, invalidatedNodeIds: [] as string[] };

    const planned = new Map(graph.map((n) => [n.id, n.versionHash]));
    for (const nodeId of staleIds) {
      const versionHash = planned.get(nodeId) ?? `invalidated-${Date.now()}`;
      await this.db
        .update(productionGraphNode)
        .set({
          status: "QUEUED",
          versionHash,
          outputAssetIds: [],
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productionGraphNode.projectId, projectId),
            eq(productionGraphNode.agentRunId, runId),
            eq(productionGraphNode.id, nodeId),
          ),
        );
    }
    return { runId, invalidatedNodeIds: staleIds };
  }

  private async buildGraphPlan(projectId: string, runId: string) {
    const scriptDoc = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "SCRIPT"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    const storyDoc = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(
          eq(productionDocument.projectId, projectId),
          eq(productionDocument.docType, "STORYBOARD"),
          eq(productionDocument.status, "ACTIVE"),
        ),
      )
      .limit(1);

    const scenes = (scriptDoc[0]?.payload as { scenes?: { id: string }[] })?.scenes?.map((s) => s.id) ?? [
      "scene-1",
      "scene-2",
      "scene-3",
    ];
    const sceneVersions = await this.loadSceneVersionRefs(projectId, scenes, scriptDoc[0]?.version ?? 1);
    const graph = planProductionGraph({
      runId,
      sceneIds: scenes,
      scriptVersion: scriptDoc[0]?.version ?? 1,
      storyboardVersion: storyDoc[0]?.version ?? 1,
      sceneVersions,
    });
    return { graph, scenes, sceneVersions };
  }

  private async loadSceneVersionRefs(
    projectId: string,
    sceneIds: string[],
    scriptVersion: number,
  ): Promise<Record<string, SceneVersionRefs>> {
    const out: Record<string, SceneVersionRefs> = {};
    for (const sceneId of sceneIds) {
      const [prompt] = await this.db
        .select()
        .from(promptVersion)
        .where(and(eq(promptVersion.projectId, projectId), eq(promptVersion.targetId, sceneId)))
        .orderBy(desc(promptVersion.version))
        .limit(1);
      out[sceneId] = {
        promptVersion: prompt?.version ?? 0,
        characterVersion: await this.characterVersionForScene(projectId, sceneId),
        sceneRevision: scriptVersion,
      };
    }
    return out;
  }

  private async characterVersionForScene(projectId: string, sceneId: string): Promise<number> {
    const [mem] = await this.db.select().from(projectMemory).where(eq(projectMemory.projectId, projectId)).limit(1);
    const chars = (mem?.characters ?? []) as Array<{ sceneIds?: string[]; version?: number }>;
    let max = 0;
    for (const c of chars) {
      if (c.sceneIds?.includes(sceneId)) max = Math.max(max, c.version ?? 1);
    }
    return max;
  }
}
