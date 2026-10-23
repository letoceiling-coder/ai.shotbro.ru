import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CreateMessageBodySchema } from "@shotbro/contracts";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { MessagesService } from "./messages.service";

@ApiTags("messages")
@Controller("api/v1/conversations/:conversationId/messages")
@UseGuards(SessionGuard)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get()
  list(@Req() req: AuthedRequest, @Param("conversationId") conversationId: string, @Query("cursor") cursor?: string) {
    return this.messages.list(req.user.id, conversationId, cursor);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Param("conversationId") conversationId: string, @Body() body: unknown) {
    const parsed = CreateMessageBodySchema.parse(body);
    if (parsed.role !== "user") {
      return { error: "Only user messages are accepted in Phase 2" };
    }
    return this.messages.createUserMessage(req.user.id, conversationId, {
      content: parsed.content,
      attachmentAssetIds: parsed.attachmentAssetIds,
      idempotencyKey: parsed.idempotencyKey,
    });
  }
}
