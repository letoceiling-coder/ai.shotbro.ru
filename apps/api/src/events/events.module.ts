import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventsController } from "./events.controller";
import { EventLogService } from "./event-log.service";

@Module({
  controllers: [EventsController],
  providers: [EventLogService, AccessPolicyService],
  exports: [EventLogService],
})
export class EventsModule {}
