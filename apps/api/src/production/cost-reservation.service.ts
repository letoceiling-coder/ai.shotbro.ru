import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { budgetReservation, costLedgerEntry, project } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";

@Injectable()
export class CostReservationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
  ) {}

  async reserve(
    userId: string,
    projectId: string,
    input: { amountUsd: number; idempotencyKey: string; agentRunId?: string; reason: string },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);

    const existing = await this.db
      .select()
      .from(budgetReservation)
      .where(eq(budgetReservation.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) return existing[0];

    return this.db.transaction(async (tx) => {
      const [proj] = await tx.select().from(project).where(eq(project.id, projectId)).limit(1);
      const budgetMax = Number((proj?.settings as { budgetMaxUsd?: number })?.budgetMaxUsd ?? 1000);
      const held = await tx
        .select({ total: sql<number>`coalesce(sum(${budgetReservation.amountUsd}), 0)` })
        .from(budgetReservation)
        .where(and(eq(budgetReservation.projectId, projectId), eq(budgetReservation.status, "HELD")));
      const currentHeld = Number(held[0]?.total ?? 0);
      if (currentHeld + input.amountUsd > budgetMax) {
        throw new ConflictException("Project budget exceeded");
      }

      const id = uuid();
      await tx.insert(budgetReservation).values({
        id,
        projectId,
        agentRunId: input.agentRunId,
        idempotencyKey: input.idempotencyKey,
        amountUsd: input.amountUsd,
        status: "HELD",
        reason: input.reason,
        createdBy: userId,
      });

      await tx.insert(costLedgerEntry).values({
        id: uuid(),
        projectId,
        agentRunId: input.agentRunId,
        reservationId: id,
        entryType: "RESERVE",
        amountUsd: input.amountUsd,
        source: "mock",
        mock: 1,
        metadata: { reason: input.reason },
      });

      const [row] = await tx.select().from(budgetReservation).where(eq(budgetReservation.id, id)).limit(1);
      return row!;
    });
  }

  async release(reservationId: string, userId: string) {
    const [row] = await this.db.select().from(budgetReservation).where(eq(budgetReservation.id, reservationId)).limit(1);
    if (!row) return;
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    if (row.status !== "HELD") return;
    await this.db
      .update(budgetReservation)
      .set({ status: "RELEASED", updatedAt: new Date() })
      .where(eq(budgetReservation.id, reservationId));
  }
}
