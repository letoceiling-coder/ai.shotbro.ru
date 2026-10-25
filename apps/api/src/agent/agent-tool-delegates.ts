import type { ToolExecutionDelegates } from "@shotbro/ai";
import type { ReferenceRole } from "@shotbro/contracts";
import type { ApprovalsService } from "../approvals/approvals.service";
import type { AssetsService } from "../assets/assets.service";
import type { CharacterContinuityService } from "../production/character-continuity.service";
import type { ProductionGraphService } from "../production/production-graph.service";
import type { ProviderJobsService } from "../providers/provider-jobs.service";
import type { ReferenceService } from "../production/reference.service";
import type { StoryboardDocumentService } from "../production/storyboard-document.service";

export function buildAgentToolDelegates(deps: {
  assets: AssetsService;
  approvals: ApprovalsService;
  graph: ProductionGraphService;
  providerJobs: ProviderJobsService;
  references: ReferenceService;
  storyboard: StoryboardDocumentService;
  characters: CharacterContinuityService;
  conversationId: string;
}): ToolExecutionDelegates {
  return {
    listAssets: async (projectId, userId) => {
      const list = await deps.assets.listForProject(userId, projectId);
      return list.map((a) => ({ id: a.id, mimeType: a.mimeType, originalName: a.originalName }));
    },
    attachReference: async ({ projectId, userId, assetId, sceneId, role, characterId }) => {
      const res = await deps.references.attach(userId, projectId, {
        assetId,
        role: (role ?? "GENERAL") as ReferenceRole,
        sceneId,
        characterId,
      });
      return { linked: true, linkId: res.link.id, duplicate: res.duplicate };
    },
    detachReference: async ({ projectId, userId, linkId }) => {
      await deps.references.detach(userId, projectId, linkId);
      return { detached: true };
    },
    getStoryboard: async ({ projectId, userId }) => {
      const board = await deps.storyboard.getActive(userId, projectId);
      return { storyboard: board?.payload ?? null, version: board?.version ?? null };
    },
    syncStoryboard: async ({ projectId, userId }) => {
      const board = await deps.storyboard.syncFromScript(userId, projectId);
      return { synced: true, version: board?.version, sceneCount: board?.payload?.scenes?.length ?? 0 };
    },
    updateStoryboardScene: async ({ projectId, userId, sceneId, patch }) => {
      const res = await deps.storyboard.patchScene(userId, projectId, sceneId, patch);
      return { updated: true, version: res?.version, sceneId };
    },
    reorderStoryboardScenes: async ({ projectId, userId, sceneIds }) => {
      const res = await deps.storyboard.reorderScenes(userId, projectId, sceneIds);
      return { reordered: true, version: res?.version };
    },
    upsertCharacter: async ({ projectId, userId, body }) => {
      const c = await deps.characters.upsert(userId, projectId, body);
      return { character: c, version: c.version };
    },
    assignCharacterToScene: async ({ projectId, userId, characterId, sceneId, characterVersion }) => {
      return deps.characters.assignToScene(userId, projectId, characterId, sceneId, { characterVersion });
    },
    setSceneFrame: async ({ projectId, userId, sceneId, frame, assetId, expectedRevision }) => {
      const patch =
        frame === "first"
          ? { firstFrameAssetId: assetId, expectedRevision }
          : { lastFrameAssetId: assetId, expectedRevision };
      await deps.storyboard.patchScene(userId, projectId, sceneId, patch);
      const role = frame === "first" ? "FIRST_FRAME" : "LAST_FRAME";
      await deps.references.attach(userId, projectId, { assetId, role, sceneId });
      return { sceneId, frame, assetId };
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
