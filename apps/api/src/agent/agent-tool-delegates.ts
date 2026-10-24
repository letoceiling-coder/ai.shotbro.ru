import type { ToolExecutionDelegates } from "@shotbro/ai";
import type { ApprovalsService } from "../approvals/approvals.service";
import type { AssetsService } from "../assets/assets.service";
import type { ProductionGraphService } from "../production/production-graph.service";
import type { ProviderJobsService } from "../providers/provider-jobs.service";

export function buildAgentToolDelegates(deps: {
  assets: AssetsService;
  approvals: ApprovalsService;
  graph: ProductionGraphService;
  providerJobs: ProviderJobsService;
  conversationId: string;
}): ToolExecutionDelegates {
  return {
    listAssets: async (projectId, userId) => {
      const list = await deps.assets.listForProject(userId, projectId);
      return list.map((a) => ({ id: a.id, mimeType: a.mimeType, originalName: a.originalName }));
    },
    attachReference: async ({ projectId, userId, assetId, sceneId }) => {
      const items = await deps.assets.listForProject(userId, projectId);
      if (!items.some((a) => a.id === assetId)) throw new Error("Asset not in project");
      return { linked: true };
    },
    requestApproval: async (input) => {
      await deps.approvals.create(input.userId, input.projectId, {
        conversationId: input.conversationId,
        title: input.title,
        description: input.description,
        targetType: input.targetType,
        targetId: input.targetId,
        targetVersion: input.targetVersion,
        payload: input.payload,
      });
    },
    startProductionGraph: async ({ projectId, userId, runId }) => {
      await deps.graph.startProductionRun(userId, projectId, runId);
      return { enqueued: true };
    },
    submitMockProviderJob: async (input) => deps.providerJobs.submitMockFromTool(input),
  };
}
