import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { approval, auditEvent } from "@shotbro/db/schema";
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
  ) {}

  hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
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
        type: `approval.${status.toLowerCase()}`,
        resourceId: approvalId,
        payload: { approvalId, status },
      });

      return { id: approvalId, status };
    });
  }
}
