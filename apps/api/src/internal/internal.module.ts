import { Module } from "@nestjs/common";
import { IntegrationUsersController } from "./integration-users.controller";
import { IntegrationUsersService } from "./integration-users.service";
import { IntegrationProvisionGuard } from "./integration-provision.guard";

@Module({
  controllers: [IntegrationUsersController],
  providers: [IntegrationUsersService, IntegrationProvisionGuard],
})
export class InternalModule {}
