import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { ConversationsService } from "./conversations.service";

@Controller("api/v1")
@UseGuards(SessionGuard)
export class ConversationsController {
  constructor(@Inject(ConversationsService) private readonly conversations: ConversationsService) {}

  @Get("projects/:projectId/conversations")
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.conversations.listForProject(req.user.id, projectId);
  }

  @Post("projects/:projectId/conversations")
  create(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: { title?: string }) {
    return this.conversations.create(req.user.id, projectId, body.title);
  }

  @Get("conversations/:id")
  get(@Req() req: AuthedRequest, @Param("id") id: string) {
    return this.conversations.get(req.user.id, id);
  }

  @Patch("conversations/:id")
  patch(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { title?: string }) {
    return this.conversations.get(req.user.id, id);
  }
}
