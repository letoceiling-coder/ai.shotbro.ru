import { Module, forwardRef } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ApprovalsModule } from "../approvals/approvals.module";
import { EventsModule } from "../events/events.module";
import { ProductionModule } from "../production/production.module";
import { AssetsModule } from "../assets/assets.module";
import { ProvidersModule } from "../providers/providers.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";
import { AgentRuntimeRolloutService } from "./agent-runtime-rollout.service";

@Module({
  imports: [EventsModule, forwardRef(() => ApprovalsModule), forwardRef(() => ProductionModule), AssetsModule, ProvidersModule],
  controllers: [AgentController],
  providers: [AgentService, AgentRuntimeRolloutService, AccessPolicyService],
  exports: [AgentService, AgentRuntimeRolloutService],
})
export class AgentModule {}
