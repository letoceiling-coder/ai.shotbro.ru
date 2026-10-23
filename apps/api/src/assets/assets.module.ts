import { Module } from "@nestjs/common";
import { AccessPolicyService } from "../access/access-policy.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AccessPolicyService],
  exports: [AssetsService],
})
export class AssetsModule {}
