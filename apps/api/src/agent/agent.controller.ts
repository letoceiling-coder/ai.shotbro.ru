import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { AgentService } from "./agent.service";

@ApiTags("agent")
@Controller("api/v1/projects/:projectId/agent")
@UseGuards(SessionGuard)
export class AgentController {
  constructor(@Inject(AgentService) private readonly agent: AgentService) {}

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
}
