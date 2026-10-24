import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProviderJobsController } from "./provider-jobs.controller";
import { ProviderJobsService } from "./provider-jobs.service";
import { ProviderJobSchedulerService } from "./provider-job-scheduler.service";
import { ProviderWebhookController } from "./provider-webhook.controller";

@Module({
  controllers: [ProviderJobsController, ProviderWebhookController],
  providers: [ProviderJobsService, ProviderJobSchedulerService, AccessPolicyService],
  exports: [ProviderJobsService],
})
export class ProvidersModule {}
