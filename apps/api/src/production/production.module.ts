import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { QueueModule } from "../queue/queue.module";
import { CostReservationService } from "./cost-reservation.service";
import { ProductionGraphService } from "./production-graph.service";
import { ProjectMemoryService } from "./project-memory.service";
import { ProductionController } from "./production.controller";
import { ProductionDocumentService } from "./production-document.service";
import { CharacterContinuityService } from "./character-continuity.service";
import { PromptVersionService } from "./prompt-version.service";

@Module({
  imports: [QueueModule],
  controllers: [ProductionController],
  providers: [
    ProductionGraphService,
    ProjectMemoryService,
    CostReservationService,
    ProductionDocumentService,
    CharacterContinuityService,
    PromptVersionService,
    AccessPolicyService,
  ],
  exports: [
    ProductionGraphService,
    ProjectMemoryService,
    CostReservationService,
    ProductionDocumentService,
    CharacterContinuityService,
    PromptVersionService,
  ],
})
export class ProductionModule {}
