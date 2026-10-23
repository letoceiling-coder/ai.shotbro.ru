import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, AccessPolicyService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
