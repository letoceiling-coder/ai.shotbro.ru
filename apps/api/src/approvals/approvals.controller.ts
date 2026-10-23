import { Body, Controller, Get, Inject, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.guard";
import { SessionGuard } from "../auth/session.guard";
import { ApprovalsService } from "./approvals.service";

const DecideSchema = z.object({
  expectedVersion: z.string(),
  payloadHash: z.string(),
  idempotencyKey: z.string().optional(),
});

@Controller("api/v1")
@UseGuards(SessionGuard)
export class ApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvals: ApprovalsService) {}

  @Get("projects/:projectId/approvals")
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.approvals.list(req.user.id, projectId);
  }

  @Post("approvals/:id/approve")
  approve(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.approvals.decide(req.user.id, id, "approve", DecideSchema.parse(body));
  }

  @Post("approvals/:id/reject")
  reject(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.approvals.decide(req.user.id, id, "reject", DecideSchema.parse(body));
  }

  @Post("approvals/:id/request-revision")
  revision(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.approvals.decide(req.user.id, id, "request-revision", DecideSchema.parse(body));
  }
}
