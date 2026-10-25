import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { ProviderRouteService } from "./provider-route.service";
import type { CanonicalSceneSettings } from "@shotbro/ai";

@ApiTags("provider-route")
@Controller("api/v1/projects/:projectId")
@UseGuards(SessionGuard)
export class ProviderRouteController {
  constructor(@Inject(ProviderRouteService) private readonly routes: ProviderRouteService) {}

  @Post("scenes/:sceneId/provider-route/plan")
  plan(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: Partial<CanonicalSceneSettings> & { operation: CanonicalSceneSettings["operation"] },
  ) {
    return this.routes.planAndPersist(req.user.id, projectId, sceneId, body);
  }

  @Post("scenes/:sceneId/provider-route/simulate-primary-failure")
  simulateFailure(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
    @Body() body: { operation: CanonicalSceneSettings["operation"]; runId?: string; fallbackEstimateUsd?: number },
  ) {
    return this.routes.simulatePrimaryFailure(req.user.id, projectId, sceneId, body);
  }

  @Get("scenes/:sceneId/provider-route")
  getSceneRoute(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Param("sceneId") sceneId: string,
  ) {
    return this.routes.getSceneRoute(req.user.id, projectId, sceneId);
  }

  @Get("provider-route/timeline")
  timeline(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.routes.listRouteTimeline(req.user.id, projectId);
  }
}
