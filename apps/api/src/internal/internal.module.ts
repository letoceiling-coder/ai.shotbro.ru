import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { AuthModule } from "../auth/auth.module";
import { InternalAgentRuntimeRolloutController } from "./agent-runtime-rollout.controller";
import { IntegrationUsersController } from "./integration-users.controller";
import { IntegrationUsersService } from "./integration-users.service";
import { IntegrationProvisionGuard } from "./integration-provision.guard";
import { IntegrationRolloutGuard } from "./integration-rollout.guard";

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [IntegrationUsersController, InternalAgentRuntimeRolloutController],
  providers: [IntegrationUsersService, IntegrationProvisionGuard, IntegrationRolloutGuard],
})
export class InternalModule {}
