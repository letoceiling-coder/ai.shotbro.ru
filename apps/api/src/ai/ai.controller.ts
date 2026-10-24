import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SessionGuard } from "../auth/session.guard";
import { AiService } from "./ai.service";

@ApiTags("ai")
@Controller("api/v1/ai")
@UseGuards(SessionGuard)
export class AiController {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  @Get("registry")
  registry() {
    return this.ai.registrySnapshot();
  }

  @Get("models")
  models() {
    return this.ai.listModels();
  }

  @Get("providers")
  providers() {
    return this.ai.listProviders();
  }

  @Get("tools")
  tools() {
    return this.ai.listTools();
  }
}
