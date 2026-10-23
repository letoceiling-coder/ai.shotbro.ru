import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { CostReservationService } from "./cost-reservation.service";
import { ProductionDocumentService } from "./production-document.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";

@ApiTags("production")
@Controller("api/v1/projects/:projectId")
@UseGuards(SessionGuard)
export class ProductionController {
  constructor(
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
    @Inject(ProductionGraphService) private readonly graph: ProductionGraphService,
    @Inject(CostReservationService) private readonly cost: CostReservationService,
    @Inject(ProductionDocumentService) private readonly documents: ProductionDocumentService,
  ) {}

  @Get("brief")
  getBrief(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.documents.getActive(req.user.id, projectId, "BRIEF");
  }

  @Patch("scripts/scenes/:sceneId")
  patchScene(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: { description?: string; durationSeconds?: number },
  ) {
    return this.documents.patchScriptScene(req.user.id, projectId, sceneId, body);
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
  getGraph(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.graph.listGraph(req.user.id, projectId);
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
