import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { z } from "zod";
import { AgentRuntimeRolloutService } from "../agent/agent-runtime-rollout.service";
import { IntegrationRolloutGuard } from "./integration-rollout.guard";

const BodySchema = z.object({
  enable: z.boolean(),
  userId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

@ApiExcludeController()
@Controller("api/v1/internal/projects/:projectId/agent-runtime-rollout")
@UseGuards(IntegrationRolloutGuard)
export class InternalAgentRuntimeRolloutController {
  constructor(@Inject(AgentRuntimeRolloutService) private readonly rollout: AgentRuntimeRolloutService) {}

  @Post()
  set(@Param("projectId") projectId: string, @Body() body: unknown) {
    const parsed = BodySchema.parse(body);
    return this.rollout.setProjectRollout({
      userId: parsed.userId,
      userEmail: "internal@loopback",
      projectId,
      enable: parsed.enable,
      reason: parsed.reason ?? "integration_rollout",
      via: "internal",
    });
  }
}
