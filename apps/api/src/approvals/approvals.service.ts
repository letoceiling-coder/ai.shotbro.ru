import { ConflictException, Inject, Injectable, NotFoundException, forwardRef } from "@nestjs/common";
import { AgentService } from "../agent/agent.service";
import { and, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { approval, auditEvent, conversation, message, messageBlock } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";
import { IdempotencyService } from "../common/idempotency.service";

@Injectable()
export class ApprovalsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
    @Inject(forwardRef(() => AgentService)) private readonly agent: AgentService,
  ) {}

  hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  async create(
    userId: string,
    projectId: string,
    input: {
      conversationId: string;
      title: string;
      description?: string;
      targetType: string;
      targetId: string;
      targetVersion: string;
      payload: Record<string, unknown>;
    },
  ) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const [conv] = await this.db
      .select()
      .from(conversation)
      .where(eq(conversation.id, input.conversationId))
      .limit(1);
    if (!conv || conv.projectId !== projectId) throw new NotFoundException("Conversation not found");

    const payloadHash = this.hashPayload(input.payload);
    const approvalId = uuid();
    await this.db.insert(approval).values({
      id: approvalId,
      projectId,
      targetType: input.targetType,
      targetId: input.targetId,
      targetVersion: input.targetVersion,
      payloadHash,
      status: "PENDING",
      requestedBy: userId,
    });

    const messageId = uuid();
    const blockPayload = {
      type: "approval",
      title: input.title,
      description: input.description,
      status: "pending",
      approvalId,
      expectedVersion: input.targetVersion,
      payloadHash,
      actions: [
        { id: "approve", label: "Утвердить", variant: "primary" },
        { id: "reject", label: "Отклонить", variant: "secondary" },
        { id: "request-revision", label: "Правки", variant: "ghost" },
      ],
    };

    await this.db.insert(message).values({
      id: messageId,
      conversationId: input.conversationId,
      projectId,
      role: "assistant",
      content: input.title,
      status: "sent",
    });
    await this.db.insert(messageBlock).values({
      id: uuid(),
      messageId,
      type: "approval",
      payload: blockPayload,
    });

    await this.events.append({
      workspaceId,
      projectId,
      type: "approval.created",
      resourceId: approvalId,
      payload: { approvalId, messageId },
    });

    return { approvalId, messageId, payloadHash, targetVersion: input.targetVersion };
  }

  /** Pending approvals for a target type no longer apply after document revision (storyboard sync, etc.). */
  async expirePendingForTargetTypes(projectId: string, targetTypes: string[]) {
    if (!targetTypes.length) return { expired: 0 };
    const pending = await this.db
      .select({ id: approval.id })
      .from(approval)
      .where(
        and(
          eq(approval.projectId, projectId),
          inArray(approval.targetType, targetTypes),
          eq(approval.status, "PENDING"),
        ),
      );
    if (!pending.length) return { expired: 0 };
    await this.db
      .update(approval)
      .set({ status: "EXPIRED", decidedAt: new Date() })
      .where(
        and(
          eq(approval.projectId, projectId),
          inArray(approval.targetType, targetTypes),
          eq(approval.status, "PENDING"),
        ),
      );
    return { expired: pending.length };
  }

  async list(userId: string, projectId: string) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const rows = await this.db.select().from(approval).where(eq(approval.projectId, projectId));
    return { workspaceId, items: rows };
  }

  async decide(
    userId: string,
    approvalId: string,
    action: "approve" | "reject" | "request-revision",
    input: { expectedVersion: string; payloadHash: string; idempotencyKey?: string },
  ) {
    return this.idempotency.run(input.idempotencyKey, userId, `approval:${action}:${approvalId}`, async () => {
      const [row] = await this.db.select().from(approval).where(eq(approval.id, approvalId)).limit(1);
      if (!row) throw new NotFoundException();
      await this.access.assertProjectAccess(this.db, userId, row.projectId);

      if (row.targetVersion !== input.expectedVersion || row.payloadHash !== input.payloadHash) {
        throw new ConflictException("Approval version mismatch");
      }
      if (row.status !== "PENDING") throw new ConflictException("Approval already decided");

      const status =
        action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "REQUIRES_REVISION";

      await this.db
        .update(approval)
        .set({ status, decidedBy: userId, decidedAt: new Date() })
        .where(and(eq(approval.id, approvalId), eq(approval.status, "PENDING")));

      await this.db.insert(auditEvent).values({
        id: uuid(),
        workspaceId: (await this.access.assertProjectAccess(this.db, userId, row.projectId)).workspaceId,
        actorId: userId,
        action: `approval.${action}`,
        resourceType: "approval",
        resourceId: approvalId,
        metadata: { targetVersion: input.expectedVersion },
      });

      const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, row.projectId);
      await this.events.append({
        workspaceId,
        projectId: row.projectId,
        type: status === "APPROVED" ? "approval.completed" : `approval.${status.toLowerCase()}`,
        resourceId: approvalId,
        payload: { approvalId, status, targetType: row.targetType },
      });

      if (status === "APPROVED") {
        await this.agent.resumeAfterApproval(row.projectId, userId, row.targetType);
      } else if (status === "REJECTED") {
        await this.agent.handleApprovalRejected(row.projectId, row.targetType, userId);
      } else if (status === "REQUIRES_REVISION") {
        await this.agent.handleApprovalRequiresRevision(row.projectId, row.targetType);
      }

      return { id: approvalId, status };
    });
  }
}
