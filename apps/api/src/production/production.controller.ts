import { Body, ConflictException, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { CostReservationService } from "./cost-reservation.service";
import { ProductionDocumentService } from "./production-document.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";
import { CharacterContinuityService } from "./character-continuity.service";
import { PromptVersionService } from "./prompt-version.service";
import { StoryboardDocumentService } from "./storyboard-document.service";
import { ReferenceService } from "./reference.service";
import { TimelineDocumentService } from "./timeline-document.service";
import { ModelParameterValidator, SceneModelSettingsSchema } from "@shotbro/ai";
import { ReferenceRoleSchema } from "@shotbro/contracts";

@ApiTags("production")
@Controller("api/v1/projects/:projectId")
@UseGuards(SessionGuard)
export class ProductionController {
  constructor(
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
    @Inject(CostReservationService) private readonly cost: CostReservationService,
    @Inject(ProductionDocumentService) private readonly documents: ProductionDocumentService,
    @Inject(CharacterContinuityService) private readonly characters: CharacterContinuityService,
    @Inject(PromptVersionService) private readonly prompts: PromptVersionService,
    @Inject(StoryboardDocumentService) private readonly storyboard: StoryboardDocumentService,
    @Inject(ReferenceService) private readonly references: ReferenceService,
    @Inject(TimelineDocumentService) private readonly timeline: TimelineDocumentService,
  ) {}

  @Get("timeline")
  getTimeline(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.timeline.ensureTimeline(req.user.id, projectId);
  }

  @Patch("timeline")
  patchTimeline(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, unknown>) {
    return this.timeline.patchDocument(req.user.id, projectId, body as { payload: never; expectedRevision?: number });
  }

  @Post("timeline/sync-from-storyboard")
  syncTimeline(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: { preview?: boolean }) {
    if (body.preview) return this.timeline.previewSyncFromStoryboard(req.user.id, projectId);
    return this.timeline.syncFromStoryboard(req.user.id, projectId, true);
  }

  @Post("timeline/reorder")
  reorderTimeline(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Body() body: { trackId: string; clipIds: string[]; expectedRevision?: number },
  ) {
    return this.timeline.reorderClips(req.user.id, projectId, body);
  }

  @Post("timeline/clips")
  upsertTimelineClip(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, unknown>) {
    const expectedRevision = body.expectedRevision as number | undefined;
    return this.timeline.upsertClip(req.user.id, projectId, body as never, expectedRevision);
  }

  @Patch("timeline/clips/:clipId")
  patchTimelineClip(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("clipId") clipId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.timeline.upsertClip(
      req.user.id,
      projectId,
      { ...body, clipId } as never,
      body.expectedRevision as number | undefined,
    );
  }

  @Post("timeline/clips/:clipId/delete")
  deleteTimelineClip(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("clipId") clipId: string,
    @Body() body: { expectedRevision?: number },
  ) {
    return this.timeline.deleteClip(req.user.id, projectId, clipId, body.expectedRevision);
  }

  @Post("timeline/validate")
  validateTimeline(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.timeline.validate(req.user.id, projectId);
  }

  @Post("timeline/prepare-assembly")
  prepareTimelineAssembly(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.timeline.prepareAssembly(req.user.id, projectId);
  }

  @Get("brief")
  getBrief(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.documents.getActive(req.user.id, projectId, "BRIEF");
  }

  @Get("script")
  getScript(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.documents.getActiveScript(req.user.id, projectId);
  }

  @Patch("script")
  patchScript(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, unknown>) {
    return this.documents.patchScriptDocument(req.user.id, projectId, body);
  }

  @Post("scripts/scenes")
  addScene(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: { afterSceneId?: string; title?: string }) {
    return this.documents.addScriptScene(req.user.id, projectId, body);
  }

  @Post("scripts/scenes/reorder")
  reorderScenes(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: { sceneIds: string[] }) {
    return this.documents.reorderScriptScenes(req.user.id, projectId, body.sceneIds ?? []);
  }

  @Post("scripts/scenes/:sceneId/duplicate")
  duplicateScene(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("sceneId") sceneId: string) {
    return this.documents.duplicateScriptScene(req.user.id, projectId, sceneId);
  }

  @Patch("scripts/scenes/:sceneId")
  patchScene(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.documents.patchScriptScene(req.user.id, projectId, sceneId, body);
  }

  @Post("scripts/scenes/:sceneId/delete")
  deleteScene(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("sceneId") sceneId: string) {
    return this.documents.deleteScriptScene(req.user.id, projectId, sceneId);
  }

  @Get("memory")
  getMemory(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.memory.get(req.user.id, projectId);
  }

  @Patch("memory")
  patchMemory(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.memory.patch(req.user.id, projectId, (body ?? {}) as Record<string, unknown>);
  }

  @Get("production-graph")
  getGraph(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Query("runId") runId?: string,
  ) {
    return this.graph.listGraph(req.user.id, projectId, runId);
  }

  @Get("characters")
  listCharacters(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.characters.list(req.user.id, projectId);
  }

  @Post("characters")
  upsertCharacter(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.characters.upsert(req.user.id, projectId, body as Parameters<CharacterContinuityService["upsert"]>[2]);
  }

  @Get("scenes/:sceneId/prompts")
  listPrompts(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("sceneId") sceneId: string) {
    return this.prompts.listForScene(req.user.id, projectId, sceneId);
  }

  @Get("scenes/:sceneId/prompts/latest")
  latestPrompt(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("sceneId") sceneId: string) {
    return this.prompts.getLatest(req.user.id, projectId, sceneId);
  }

  @Get("scenes/:sceneId/prompts/compare")
  comparePrompts(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Query("a") a: string,
    @Query("b") b: string,
  ) {
    return this.prompts.compareVersions(req.user.id, projectId, sceneId, Number(a), Number(b));
  }

  @Get("scenes/:sceneId/prompts/versions/:version")
  getPromptVersion(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Param("version") version: string,
  ) {
    return this.prompts.getByVersion(req.user.id, projectId, sceneId, Number(version));
  }

  @Get("scenes/:sceneId/model-settings")
  async getSceneModelSettings(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
  ) {
    const mem = await this.memory.get(req.user.id, projectId);
    const prefs = (mem.preferences ?? {}) as { sceneModelSettings?: Record<string, unknown> };
    const hit = prefs.sceneModelSettings?.[sceneId];
    return SceneModelSettingsSchema.parse({ sceneId, version: 1, parameters: {}, ...(hit ?? {}) });
  }

  @Patch("scenes/:sceneId/model-settings")
  async patchSceneModelSettings(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const current = await this.getSceneModelSettings(req, projectId, sceneId);
    if (body.expectedVersion != null && body.expectedVersion !== current.version) {
      throw new ConflictException({ code: "scene_model_settings_conflict", currentVersion: current.version });
    }
    const validator = new ModelParameterValidator();
    const nextParams = { ...current.parameters, ...(body.parameters as Record<string, Record<string, unknown>>) };
    for (const [modelId, params] of Object.entries(nextParams)) {
      const op =
        modelId.includes("upscaler") || modelId.includes("magnific") ? "IMAGE_UPSCALE" : "TEXT_TO_IMAGE";
      const check = validator.validate(modelId, op, params);
      if (!check.valid) return { valid: false, issues: check.issues };
    }
    const next = SceneModelSettingsSchema.parse({
      ...current,
      ...body,
      sceneId,
      parameters: nextParams,
      version: current.version + 1,
    });
    const mem = await this.memory.get(req.user.id, projectId);
    const prefs = (mem.preferences ?? {}) as { sceneModelSettings?: Record<string, unknown> };
    const sceneModelSettings = { ...(prefs.sceneModelSettings ?? {}), [sceneId]: next };
    await this.memory.patch(req.user.id, projectId, { preferences: { ...prefs, sceneModelSettings } });
    return next;
  }

  @Post("scenes/:sceneId/prompts")
  createPrompt(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body()
    body:
      | { bundle: Record<string, unknown>; changeNote?: string }
      | { modelId?: string; renderedPrompt: string; parameters?: Record<string, unknown> },
  ) {
    if ("bundle" in body && body.bundle) {
      return this.prompts.saveScenePrompt(req.user.id, projectId, sceneId, body);
    }
    const legacy = body as { modelId?: string; renderedPrompt: string; parameters?: Record<string, unknown> };
    return this.prompts.create(req.user.id, projectId, { sceneId, ...legacy });
  }

  @Post("scenes/:sceneId/prompts/restore")
  restorePrompt(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: { version: number },
  ) {
    return this.prompts.restoreVersion(req.user.id, projectId, sceneId, body.version);
  }

  @Post("scenes/:sceneId/prompts/validate")
  validatePrompt(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: { modelId: string; operation: string; parameters?: Record<string, unknown> },
  ) {
    return this.prompts.validateForModel(req.user.id, projectId, sceneId, body);
  }

  @Get("storyboard")
  getStoryboard(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.storyboard.getActive(req.user.id, projectId);
  }

  @Post("storyboard/sync")
  syncStoryboard(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.storyboard.syncFromScript(req.user.id, projectId);
  }

  @Patch("storyboard/scenes/:sceneId")
  patchStoryboardScene(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.storyboard.patchScene(req.user.id, projectId, sceneId, body);
  }

  @Post("storyboard/scenes/reorder")
  reorderStoryboard(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: { sceneIds: string[] }) {
    return this.storyboard.reorderScenes(req.user.id, projectId, body.sceneIds ?? []);
  }

  @Post("characters/:characterId/assign-scene")
  async assignCharacterScene(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("characterId") characterId: string,
    @Body() body: { sceneId: string; characterVersion?: number },
  ) {
    const assigned = await this.characters.assignToScene(req.user.id, projectId, characterId, body.sceneId, {
      characterVersion: body.characterVersion,
    });
    try {
      const board = await this.storyboard.getActive(req.user.id, projectId);
      const scene = board?.payload.scenes.find((s) => s.sceneId === body.sceneId);
      if (scene) {
        await this.storyboard.patchScene(req.user.id, projectId, body.sceneId, {
          characterIds: [...new Set([...scene.characterIds, characterId])],
          characterVersionById: {
            ...scene.characterVersionById,
            [characterId]: assigned.characterVersion as number,
          },
          expectedRevision: scene.revision,
        });
      }
    } catch {
      /* no storyboard yet */
    }
    return assigned;
  }

  @Post("characters/:characterId/restore")
  restoreCharacter(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("characterId") characterId: string,
    @Body() body: { version: number },
  ) {
    return this.characters.restoreVersion(req.user.id, projectId, characterId, body.version);
  }

  @Get("references")
  listReferences(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Query("sceneId") sceneId?: string,
    @Query("characterId") characterId?: string,
  ) {
    return this.references.list(req.user.id, projectId, { sceneId, characterId });
  }

  @Post("references")
  attachReference(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Body()
    body: {
      assetId: string;
      role?: string;
      sceneId?: string;
      characterId?: string;
      idempotencyKey?: string;
    },
  ) {
    const role = ReferenceRoleSchema.parse(body.role ?? "GENERAL");
    return this.references.attach(req.user.id, projectId, {
      assetId: body.assetId,
      role,
      sceneId: body.sceneId,
      characterId: body.characterId,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("references/:linkId/detach")
  detachReference(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("linkId") linkId: string) {
    return this.references.detach(req.user.id, projectId, linkId);
  }

  @Patch("references/:linkId")
  patchReference(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("linkId") linkId: string,
    @Body() body: { role: string },
  ) {
    return this.references.updateRole(req.user.id, projectId, linkId, ReferenceRoleSchema.parse(body.role));
  }

  @Post("cost/reserve")
  reserveCost(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Body() body: { amountUsd: number; idempotencyKey: string; agentRunId?: string; reason: string },
  ) {
    return this.cost.reserve(req.user.id, projectId, body);
  }
}
