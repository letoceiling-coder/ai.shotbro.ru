import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { CostReservationService } from "./cost-reservation.service";
import { ProductionDocumentService } from "./production-document.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";
import { CharacterContinuityService } from "./character-continuity.service";
import { PromptVersionService } from "./prompt-version.service";

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
  ) {}

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

  @Post("scenes/:sceneId/prompts")
  createPrompt(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: { modelId?: string; renderedPrompt: string; parameters?: Record<string, unknown> },
  ) {
    return this.prompts.create(req.user.id, projectId, { sceneId, ...body });
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
