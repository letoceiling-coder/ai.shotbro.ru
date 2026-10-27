import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { AgentService } from "./agent.service";
import { AgentRuntimeRolloutService } from "./agent-runtime-rollout.service";

@ApiTags("agent")
@Controller("api/v1/projects/:projectId/agent")
@UseGuards(SessionGuard)
export class AgentController {
  constructor(
    @Inject(AgentService) private readonly agent: AgentService,
    @Inject(AgentRuntimeRolloutService) private readonly rollout: AgentRuntimeRolloutService,
  ) {}

  @Get("runs")
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.agent.listRuns(req.user.id, projectId);
  }

  @Get("runs/:runId")
  get(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.agent.getRun(req.user.id, projectId, runId);
  }

  @Post("runs")
  create(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.agent.createRun(req.user.id, projectId, body);
  }

  @Post("creative-turn")
  creativeTurn(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.agent.runCreativeTurn(req.user.id, projectId, body);
  }

  @Post("runs/:runId/resume")
  resume(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.agent.resumeRun(req.user.id, projectId, runId);
  }

  @Post("runs/:runId/pause")
  pause(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.agent.pauseRun(req.user.id, projectId, runId);
  }

  @Post("runs/:runId/cancel")
  cancel(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.agent.cancelRun(req.user.id, projectId, runId);
  }

  @Get("runs/:runId/trace")
  trace(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Param("runId") runId: string) {
    return this.agent.getRunTrace(req.user.id, projectId, runId);
  }

  @Get("runtime-rollout")
  runtimeRollout(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.rollout.getRolloutStatus(req.user.id, projectId);
  }

  @Post("runtime-rollout")
  setRuntimeRollout(
    @Req() req: AuthedRequest,
    @Param("projectId") projectId: string,
    @Body() body: { enable: boolean; reason?: string },
  ) {
    return this.rollout.setProjectRollout({
      userId: req.user.id,
      userEmail: req.user.email,
      projectId,
      enable: Boolean(body.enable),
      reason: body.reason,
      via: "admin",
    });
  }
}
