import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventsModule } from "../events/events.module";
import { ProductionModule } from "../production/production.module";
import { ProviderJobsController } from "./provider-jobs.controller";
import { ProviderJobsService } from "./provider-jobs.service";
import { ProviderJobSchedulerService } from "./provider-job-scheduler.service";
import { ProviderJobEventBridgeService } from "./provider-job-event-bridge.service";
import { ProviderJobRuntimeService } from "./provider-job-runtime.service";
import { ProviderWebhookController } from "./provider-webhook.controller";
import { ProviderCatalogController } from "./provider-catalog.controller";

@Module({
  imports: [ProductionModule, EventsModule],
  controllers: [ProviderJobsController, ProviderWebhookController, ProviderCatalogController],
  providers: [
    ProviderJobsService,
    ProviderJobSchedulerService,
    ProviderJobEventBridgeService,
    ProviderJobRuntimeService,
    AccessPolicyService,
  ],
  exports: [ProviderJobsService, ProviderJobRuntimeService],
})
export class ProvidersModule {}
