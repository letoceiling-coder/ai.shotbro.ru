import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
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
  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("cursor") cursor?: string,
    @Query("q") q?: string,
    @Query("archived") archived?: string,
  ) {
    return this.projectsService.list(req.user.id, {
      cursor,
      q,
      archived: archived === "true",
    });
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const parsed = CreateProjectBodySchema.parse(body);
    return this.projectsService.create(req.user.id, parsed.title, parsed.description);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.get(req.user.id, id);
  }

  @Patch(":id")
  rename(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { title?: string; description?: string }) {
    return this.projectsService.patch(req.user.id, id, body);
  }

  @Post(":id/duplicate")
  duplicate(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.duplicate(req.user.id, id);
  }

  @Post(":id/archive")
  archive(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.archive(req.user.id, id);
  }

  @Post(":id/restore")
  restore(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.restore(req.user.id, id);
  }

  @Delete(":id")
  remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.projectsService.softDelete(req.user.id, id);
  }
}
