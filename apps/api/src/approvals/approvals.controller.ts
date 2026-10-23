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

const CreateApprovalSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  targetVersion: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

@Controller("api/v1")
@UseGuards(SessionGuard)
export class ApprovalsController {
  constructor(@Inject(ApprovalsService) private readonly approvals: ApprovalsService) {}

  @Get("projects/:projectId/approvals")
  list(@Req() req: AuthedRequest, @Param("projectId") projectId: string) {
    return this.approvals.list(req.user.id, projectId);
  }

  @Post("projects/:projectId/approvals")
  create(@Req() req: AuthedRequest, @Param("projectId") projectId: string, @Body() body: unknown) {
    return this.approvals.create(req.user.id, projectId, CreateApprovalSchema.parse(body));
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
