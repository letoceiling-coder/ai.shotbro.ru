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
import { ProductionAssetIngestionService } from "./production-asset-ingestion.service";
import { StoryboardDocumentService } from "./storyboard-document.service";
import { ReferenceService } from "./reference.service";
import { AssetsModule } from "../assets/assets.module";

@Module({
  imports: [QueueModule, AssetsModule],
  controllers: [ProductionController],
  providers: [
    ProductionGraphService,
    ProjectMemoryService,
    CostReservationService,
    ProductionDocumentService,
    StoryboardDocumentService,
    ReferenceService,
    CharacterContinuityService,
    PromptVersionService,
    ProductionAssetIngestionService,
    AccessPolicyService,
  ],
  exports: [
    ProductionGraphService,
    ProjectMemoryService,
    CostReservationService,
    ProductionDocumentService,
    StoryboardDocumentService,
    ReferenceService,
    CharacterContinuityService,
    PromptVersionService,
    ProductionAssetIngestionService,
  ],
})
export class ProductionModule {}
