import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ApprovalsModule } from "../approvals/approvals.module";
import { ProductionModule } from "../production/production.module";
import { CanvasController } from "./canvas.controller";
import { CanvasService } from "./canvas.service";

@Module({
  imports: [ProductionModule, ApprovalsModule],
  controllers: [CanvasController],
  providers: [CanvasService, AccessPolicyService],
  exports: [CanvasService],
})
export class CanvasModule {}
