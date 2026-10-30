import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ApprovalsModule } from "../approvals/approvals.module";
import { ProductionModule } from "../production/production.module";
import { CanvasController } from "./canvas.controller";
import { CanvasService } from "./canvas.service";
import { CANVAS_SERVICE_TOKEN } from "./canvas.tokens";

@Module({
  imports: [ProductionModule, ApprovalsModule],
  controllers: [CanvasController],
  // String token lets AgentService resolve the service lazily without a circular file import.
  providers: [CanvasService, AccessPolicyService, { provide: CANVAS_SERVICE_TOKEN, useExisting: CanvasService }],
  exports: [CanvasService, CANVAS_SERVICE_TOKEN],
})
export class CanvasModule {}
