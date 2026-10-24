import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { IntegrationUsersController } from "./integration-users.controller";
import { IntegrationUsersService } from "./integration-users.service";
import { IntegrationProvisionGuard } from "./integration-provision.guard";

@Module({
  imports: [AuthModule],
  controllers: [IntegrationUsersController],
  providers: [IntegrationUsersService, IntegrationProvisionGuard],
})
export class InternalModule {}
