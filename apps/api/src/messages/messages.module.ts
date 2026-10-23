import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, AccessPolicyService],
})
export class MessagesModule {}
