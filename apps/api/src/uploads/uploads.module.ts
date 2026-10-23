import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, AccessPolicyService],
})
export class UploadsModule {}
