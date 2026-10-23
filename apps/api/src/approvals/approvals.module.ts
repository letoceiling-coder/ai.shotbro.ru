import { Module, forwardRef } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { IdempotencyService } from "../common/idempotency.service";
import { EventsModule } from "../events/events.module";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  imports: [EventsModule, forwardRef(() => AgentModule)],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, AccessPolicyService, IdempotencyService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
