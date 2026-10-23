import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { IdempotencyService } from "../common/idempotency.service";
import { EventsModule } from "../events/events.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [EventsModule],
  controllers: [MessagesController],
  providers: [MessagesService, AccessPolicyService, IdempotencyService],
})
export class MessagesModule {}
