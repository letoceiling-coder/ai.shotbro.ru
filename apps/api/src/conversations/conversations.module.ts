import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";

@Module({
  controllers: [ConversationsController],
  providers: [ConversationsService, AccessPolicyService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
