import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { IntegrationProvisionGuard } from "./integration-provision.guard";
import { IntegrationUsersService } from "./integration-users.service";

@ApiExcludeController()
@Controller("api/v1/internal/integration-users")
@UseGuards(IntegrationProvisionGuard)
export class IntegrationUsersController {
  constructor(private readonly users: IntegrationUsersService) {}

  @Post("provision")
  provision() {
    return this.users.provisionAll();
  }
}
