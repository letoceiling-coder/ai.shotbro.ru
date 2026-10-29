import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProductionModule } from "../production/production.module";
import { ProjectsModule } from "../projects/projects.module";
import { TalentController } from "./talent.controller";
import { TalentService } from "./talent.service";

@Module({
  imports: [ProductionModule, ProjectsModule],
  controllers: [TalentController],
  providers: [TalentService, AccessPolicyService],
  exports: [TalentService],
})
export class TalentModule {}
