import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionModule } from "../production/production.module";
import { ProjectsModule } from "../projects/projects.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { TalentController } from "./talent.controller";
import { TalentService } from "./talent.service";
import { TalentJobsService } from "./talent-jobs.service";
import { TALENT_JOBS_SERVICE_TOKEN, TALENT_SERVICE_TOKEN } from "./talent.tokens";

@Module({
  imports: [ProductionModule, ProjectsModule, ApprovalsModule],
  controllers: [TalentController],
  providers: [
    TalentService,
    TalentJobsService,
    AccessPolicyService,
    // String tokens let AgentService resolve these lazily without a circular file import.
    { provide: TALENT_SERVICE_TOKEN, useExisting: TalentService },
    { provide: TALENT_JOBS_SERVICE_TOKEN, useExisting: TalentJobsService },
  ],
  exports: [TalentService, TalentJobsService, TALENT_SERVICE_TOKEN, TALENT_JOBS_SERVICE_TOKEN],
})
export class TalentModule {}
