import type { TalentDelegates, ToolExecutionDelegates } from "@shotbro/ai";
import type { ReferenceRole } from "@shotbro/contracts";
import type { ApprovalsService } from "../approvals/approvals.service";
import type { AssetsService } from "../assets/assets.service";
import type { CharacterContinuityService } from "../production/character-continuity.service";
import type { ProductionGraphService } from "../production/production-graph.service";
import type { ProviderJobsService } from "../providers/provider-jobs.service";
import type { ReferenceService } from "../production/reference.service";
import type { StoryboardDocumentService } from "../production/storyboard-document.service";
import type { PromptVersionService } from "../production/prompt-version.service";
import type { TimelineDocumentService } from "../production/timeline-document.service";
import type { ScenePromptBundle, TimelineClip } from "@shotbro/contracts";
import { randomUUID } from "node:crypto";

export function buildAgentToolDelegates(deps: {
  assets: AssetsService;
  approvals: ApprovalsService;
  graph: ProductionGraphService;
  providerJobs: ProviderJobsService;
  references: ReferenceService;
  storyboard: StoryboardDocumentService;
  characters: CharacterContinuityService;
  prompts: PromptVersionService;
  timeline: TimelineDocumentService;
  conversationId: string;
  talent?: TalentDelegates;
}): ToolExecutionDelegates {
  const findClip = (tracks: { clips: TimelineClip[] }[], clipId: string) => {
    for (const t of tracks) {
      const hit = t.clips.find((c) => c.clipId === clipId);
      if (hit) return hit;
    }
    return null;
  };

  return {
    talent: deps.talent,
    listAssets: async (projectId, userId) => {
      const list = await deps.assets.listLegacyForProject(userId, projectId);
      return list.map((a) => ({ id: a.id, mimeType: a.mimeType, originalName: a.originalName }));
    },
    searchAssets: async ({ projectId, userId, filter, status, q, limit }) => {
      const page = await deps.assets.listLibrary(userId, projectId, {
        filter: filter === "all" ? "all" : filter,
        q,
        limit,
      });
      let items = page.items.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        originalName: a.originalName,
        status: a.status,
        roles: a.roles,
      }));
      if (status !== "any") {
        items = items.filter((a) => a.status === status);
      }
      return items;
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
    getScenePrompt: async ({ projectId, userId, sceneId }) => {
      try {
        const latest = await deps.prompts.getLatest(userId, projectId, sceneId);
        return { sceneId, version: latest.version, bundle: latest.bundle, modelId: latest.modelId, mock: true };
      } catch {
        return { sceneId, version: null, bundle: null, mock: true };
      }
    },
    saveScenePrompt: async ({ projectId, userId, sceneId, bundle, changeNote }) => {
      const res = await deps.prompts.saveScenePrompt(userId, projectId, sceneId, { bundle, changeNote });
      return { sceneId, version: res.version, bundle: res.bundle, invalidation: res.invalidation, mock: true };
    },
    listPromptVersions: async ({ projectId, userId, sceneId }) => {
      const list = await deps.prompts.listForScene(userId, projectId, sceneId);
      return {
        sceneId,
        items: list.items.map((i) => ({
          version: i.version,
          modelId: i.modelId,
          createdAt: i.createdAt,
          createdBy: i.createdBy,
          approvalState: i.approvalState,
        })),
        mock: true,
      };
    },
    comparePromptVersions: async ({ projectId, userId, sceneId, versionA, versionB }) => {
      const cmp = await deps.prompts.compareVersions(userId, projectId, sceneId, versionA, versionB);
      return { ...cmp, mock: true };
    },
    restorePromptVersion: async ({ projectId, userId, sceneId, version }) => {
      const res = await deps.prompts.restoreVersion(userId, projectId, sceneId, version);
      return { sceneId, version: res.version, restoredFrom: version, bundle: res.bundle, mock: true };
    },
    getSceneModelSettings: async ({ projectId, userId, sceneId }) => {
      const settings = await deps.prompts.getSceneModelSettingsSnapshot(userId, projectId, sceneId);
      return { sceneId, settings, mock: true };
    },
    validatePromptForModel: async ({ projectId, userId, sceneId, modelId, operation, parameters }) => {
      const check = await deps.prompts.validateForModel(userId, projectId, sceneId, {
        modelId,
        operation,
        parameters,
      });
      return { ...check, mock: true };
    },
    prepareScenePrompt: async ({ projectId, userId, sceneId, focus }) => {
      const board = await deps.storyboard.getActive(userId, projectId);
      const scene = board?.payload?.scenes?.find((s) => s.sceneId === sceneId);
      let bundle: ScenePromptBundle | null = null;
      let version: number | null = null;
      try {
        const latest = await deps.prompts.getLatest(userId, projectId, sceneId);
        bundle = latest.bundle;
        version = latest.version;
      } catch {
        bundle = {
          image: { prompt: scene?.description?.trim() || scene?.title || "Scene still" },
          video: { sceneAction: scene?.description ?? "", durationSeconds: scene?.durationSeconds },
          imageModelId: "mock/image",
          videoModelId: "mock/video",
        };
      }
      const settings = await deps.prompts.getSceneModelSettingsSnapshot(userId, projectId, sceneId);
      return {
        sceneId,
        focus,
        version,
        bundle,
        settingsSnapshot: settings,
        storyboardTitle: scene?.title,
        mockOnly: true,
        notes: [
          "Live provider execution disabled — prompts are persisted only.",
          bundle?.imageModelId ? `Image model: ${bundle.imageModelId}` : null,
        ].filter(Boolean),
      };
    },
    getTimeline: async ({ projectId, userId }) => {
      const row = await deps.timeline.ensureTimeline(userId, projectId);
      return {
        documentId: row.id,
        version: row.version,
        revision: row.payload.revision,
        totalDurationMs: row.payload.totalDurationMs,
        tracks: row.payload.tracks,
        timelineHash: row.timelineHash,
        mock: true,
      };
    },
    createTimelineFromStoryboard: async ({ projectId, userId, preview }) => {
      if (preview) {
        const p = await deps.timeline.previewSyncFromStoryboard(userId, projectId);
        return { preview: true, ...p, mock: true };
      }
      const row = await deps.timeline.syncFromStoryboard(userId, projectId, true);
      return {
        documentId: row.id,
        version: row.version,
        revision: row.payload.revision,
        clipCount: row.payload.tracks.find((t) => t.type === "VIDEO")?.clips.length ?? 0,
        mock: true,
      };
    },
    updateTimelineClip: async ({ projectId, userId, clip, expectedRevision }) => {
      const parsed = clip as TimelineClip;
      const row = await deps.timeline.upsertClip(userId, projectId, parsed, expectedRevision);
      return { clipId: parsed.clipId, revision: row.payload.revision, version: row.version, mock: true };
    },
    reorderTimelineClips: async ({ projectId, userId, trackId, clipIds, expectedRevision }) => {
      const row = await deps.timeline.reorderClips(userId, projectId, { trackId, clipIds, expectedRevision });
      return { trackId, clipIds, revision: row.payload.revision, version: row.version, mock: true };
    },
    setClipDuration: async ({ projectId, userId, clipId, durationMs, expectedRevision }) => {
      const current = await deps.timeline.ensureTimeline(userId, projectId);
      const target = findClip(current.payload.tracks, clipId);
      if (!target) throw new Error(`clip ${clipId} not found`);
      const row = await deps.timeline.upsertClip(userId, projectId, { ...target, durationMs }, expectedRevision);
      return { clipId, durationMs, revision: row.payload.revision, version: row.version, mock: true };
    },
    attachAudioTrack: async ({
      projectId,
      userId,
      assetId,
      trackType,
      startTimeMs,
      durationMs,
      volume,
      expectedRevision,
    }) => {
      const trackId =
        trackType === "VOICEOVER" ? "track-voice" : trackType === "MUSIC" ? "track-music" : "track-sfx";
      const current = await deps.timeline.ensureTimeline(userId, projectId);
      const track = current.payload.tracks.find((t) => t.id === trackId);
      const order = track?.clips.length ?? 0;
      const row = await deps.timeline.upsertClip(
        userId,
        projectId,
        {
          clipId: randomUUID(),
          trackId,
          assetId,
          startTimeMs,
          durationMs,
          order,
          volume: volume ?? 1,
          muted: false,
          status: "ready",
          sourceInMs: 0,
        },
        expectedRevision,
      );
      return { trackId, assetId, revision: row.payload.revision, version: row.version, mock: true };
    },
    validateTimeline: async ({ projectId, userId }) => {
      const check = await deps.timeline.validate(userId, projectId);
      return { ...check, mock: true };
    },
    prepareTimelineAssembly: async ({ projectId, userId }) => {
      const prep = await deps.timeline.prepareAssembly(userId, projectId);
      return { ...prep, mock: true };
    },
  };
}
