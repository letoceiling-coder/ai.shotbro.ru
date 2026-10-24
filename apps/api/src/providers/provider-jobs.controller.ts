import { Controller, Get, Inject, Param, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SessionGuard } from "../auth/session.guard";
import type { AuthedRequest } from "../auth/session.guard";
import { ProviderJobsService } from "./provider-jobs.service";

@ApiTags("provider-jobs")
@Controller("api/v1/projects/:projectId/provider-jobs")
@UseGuards(SessionGuard)
export class ProviderJobsController {
  constructor(@Inject(ProviderJobsService) private readonly jobs: ProviderJobsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.jobs.listForProject(req.user.id, projectId);
  }
}
