import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { QueueModule } from "../queue/queue.module";
import { CostReservationService } from "./cost-reservation.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";
import { ProductionController } from "./production.controller";

@Module({
  imports: [QueueModule],
  controllers: [ProductionController],
  providers: [ProductionGraphService, ProjectMemoryService, CostReservationService, AccessPolicyService],
  exports: [ProductionGraphService, ProjectMemoryService, CostReservationService],
})
export class ProductionModule {}
