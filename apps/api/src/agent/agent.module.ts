import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventsModule } from "../events/events.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [EventsModule],
  controllers: [AgentController],
  providers: [AgentService, AccessPolicyService],
  exports: [AgentService],
})
export class AgentModule {}
