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
import { ProviderRouterController } from "./provider-router.controller";
import { ProviderRouteService } from "./provider-route.service";
import { ProviderRouteController } from "./provider-route.controller";

@Module({
  imports: [ProductionModule, EventsModule],
  controllers: [
    ProviderJobsController,
    ProviderWebhookController,
    ProviderCatalogController,
    ProviderRouterController,
    ProviderRouteController,
  ],
  providers: [
    ProviderJobsService,
    ProviderJobSchedulerService,
    ProviderJobEventBridgeService,
    ProviderJobRuntimeService,
    ProviderRouteService,
    AccessPolicyService,
  ],
  exports: [ProviderJobsService, ProviderJobRuntimeService, ProviderRouteService],
})
export class ProvidersModule {}
