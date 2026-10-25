import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
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

    const timelineSnap = await this.loadTimelineSnapshot(projectId);
    const priorMeta = (run.metadata ?? {}) as Record<string, unknown>;
    await this.db
      .update(agentRun)
      .set({
        metadata: { ...priorMeta, ...timelineSnap, mock: true },
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, runId));

    const enqueued = await this.queue.enqueueProductionRun({
      runId,
      projectId,
      ownerId: userId,
      workspaceId,
      ...timelineSnap,
    });

    return { runId, nodeCount: graph.length, sceneCount: scenes.length, enqueued, timeline: timelineSnap };
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

  async invalidateAssemblyForTimelineChange(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const runs = await this.db.select().from(agentRun).where(eq(agentRun.projectId, projectId));
    const touched: string[] = [];
    for (const run of runs) {
      if (run.status === "COMPLETED" && run.productionState === "COMPLETED") continue;
      const nodes = await this.db
        .select()
        .from(productionGraphNode)
        .where(and(eq(productionGraphNode.projectId, projectId), eq(productionGraphNode.agentRunId, run.id)));
      for (const node of nodes) {
        if (node.nodeType !== "ASSEMBLY" && node.nodeType !== "TIMELINE") continue;
        await this.db
          .update(productionGraphNode)
          .set({ status: "QUEUED", outputAssetIds: [], updatedAt: new Date() })
          .where(eq(productionGraphNode.id, node.id));
        touched.push(node.id);
      }
    }
    return { invalidatedNodeIds: touched };
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

    const timelineOrder = await this.timelineSceneOrder(projectId);
    const scriptScenes = (scriptDoc[0]?.payload as { scenes?: { id: string }[] })?.scenes?.map((s) => s.id) ?? [];
    const scenes = timelineOrder?.length ? timelineOrder : scriptScenes.length ? scriptScenes : ["scene-1", "scene-2", "scene-3"];
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

  private async loadTimelineSnapshot(projectId: string) {
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "TIMELINE"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    if (!row || row.schemaVersion !== 2) return {};
    const payload = row.payload as Record<string, unknown>;
    const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return {
      timelineDocumentId: row.id,
      timelineVersion: row.version,
      timelineHash: hash,
    };
  }

  private async timelineSceneOrder(projectId: string): Promise<string[] | null> {
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(eq(productionDocument.projectId, projectId), eq(productionDocument.docType, "TIMELINE"), eq(productionDocument.status, "ACTIVE")),
      )
      .limit(1);
    if (!row || row.schemaVersion !== 2) return null;
    const payload = row.payload as { tracks?: Array<{ type: string; clips?: Array<{ order: number; sceneId?: string }> }> };
    const video = payload.tracks?.find((t) => t.type === "VIDEO");
    if (!video?.clips?.length) return null;
    return [...video.clips]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.sceneId)
      .filter((id): id is string => Boolean(id));
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
