import { Body, Controller, Get, Inject, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { CanvasService } from "./canvas.service";

/** Phase 6E: scene canvas («Сцены») — view over the storyboard, node runs via approval. */
@ApiTags("canvas")
@Controller("api/v1/projects/:projectId/canvas")
@UseGuards(SessionGuard)
export class CanvasController {
  constructor(@Inject(CanvasService) private readonly canvas: CanvasService) {}

  /** Canvas + scene summaries + run history; new storyboard scenes are added automatically. */
  @Get()
  get(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.canvas.get(req.user.id, projectId);
  }

  /** Autosave with optimistic locking (`expectedVersion`). */
  @Put()
  save(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.canvas.save(req.user.id, projectId, body);
  }

  /** Price card for one node or the whole graph («Собрать всё»): approval in chat, budget held. */
  @Post("quote")
  quote(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.canvas.quote(req.user.id, projectId, body);
  }
}
