import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CreateProjectBodySchema } from "@shotbro/contracts";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("api/v1/projects")
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Query("cursor") cursor?: string) {
    return this.projects.list(req.user.id, cursor);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = CreateProjectBodySchema.parse(body);
    return this.projects.create(req.user.id, parsed.title, parsed.description);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projects.get(req.user.id, id);
  }

  @Patch(":id")
  rename(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { title?: string; description?: string }) {
    return this.projects.patch(req.user.id, id, body);
  }
}
