import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionModule } from "../production/production.module";
import { ProviderJobsController } from "./provider-jobs.controller";
import { ProviderJobsService } from "./provider-jobs.service";
import { ProviderJobSchedulerService } from "./provider-job-scheduler.service";
import { ProviderWebhookController } from "./provider-webhook.controller";

@Module({
  imports: [ProductionModule],
  controllers: [ProviderJobsController, ProviderWebhookController],
  providers: [ProviderJobsService, ProviderJobSchedulerService, AccessPolicyService],
  exports: [ProviderJobsService],
})
export class ProvidersModule {}
