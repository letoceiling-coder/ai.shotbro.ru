import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProviderJobsController } from "./provider-jobs.controller";
import { ProviderJobsService } from "./provider-jobs.service";

@Module({
  controllers: [ProviderJobsController],
  providers: [ProviderJobsService, AccessPolicyService],
  exports: [ProviderJobsService],
})
export class ProvidersModule {}
