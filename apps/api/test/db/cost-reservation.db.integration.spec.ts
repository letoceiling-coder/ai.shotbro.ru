import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createDb } from "@shotbro/db/client";
import { budgetReservation, costLedgerEntry, project, user, workspace, workspaceMember } from "@shotbro/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { CostReservationService } from "../../src/production/cost-reservation.service";
import { AccessPolicyService } from "../../src/access/access-policy.service";

const dbUrl = process.env.INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const enabled = Boolean(process.env.RUN_DB_INTEGRATION_TESTS === "1" && dbUrl);

describe.skipIf(!enabled)("CostReservationService (PostgreSQL)", () => {
  const { db, client } = createDb(dbUrl!);
  const cost = new CostReservationService(db, new AccessPolicyService());
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    userId = uuid();
    const workspaceId = uuid();
    projectId = uuid();
    await db.insert(user).values({
      id: userId,
      name: "Budget Test",
      email: `budget-${userId}@shotbro.test`,
      emailVerified: true,
    });
    await db.insert(workspace).values({ id: workspaceId, name: "WS", ownerId: userId });
    await db.insert(workspaceMember).values({
      workspaceId,
      userId,
      role: "OWNER",
    });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      ownerId: userId,
      title: "Budget project",
      settings: { budgetMaxUsd: 10 },
    });
  });

  afterAll(async () => {
    await db.delete(costLedgerEntry).where(eq(costLedgerEntry.projectId, projectId));
    await db.delete(budgetReservation).where(eq(budgetReservation.projectId, projectId));
    await db.delete(project).where(eq(project.id, projectId));
    await client.end();
  });

  it("same idempotency key under concurrency returns one reservation and one RESERVE ledger row", async () => {
    const key = `db-idem-${uuid()}`;
    const input = { amountUsd: 1, idempotencyKey: key, reason: "concurrency_test" };
    const [a, b] = await Promise.all([
      cost.reserve(userId, projectId, input),
      cost.reserve(userId, projectId, input),
    ]);
    expect(a.id).toBe(b.id);
    const rows = await db
      .select()
      .from(budgetReservation)
      .where(eq(budgetReservation.idempotencyKey, key));
    expect(rows).toHaveLength(1);
    const ledger = await db
      .select()
      .from(costLedgerEntry)
      .where(and(eq(costLedgerEntry.reservationId, a.id), eq(costLedgerEntry.entryType, "RESERVE")));
    expect(ledger).toHaveLength(1);
  });

  it("different keys cannot exceed budget (no negative available)", async () => {
    const p2 = uuid();
    await db.insert(project).values({
      id: p2,
      workspaceId: (await db.select().from(project).where(eq(project.id, projectId)).limit(1))[0]!.workspaceId,
      ownerId: userId,
      title: "Tight budget",
      settings: { budgetMaxUsd: 5 },
    });
    const k1 = `k1-${uuid()}`;
    const k2 = `k2-${uuid()}`;
    await cost.reserve(userId, p2, { amountUsd: 3, idempotencyKey: k1, reason: "a" });
    await expect(
      cost.reserve(userId, p2, { amountUsd: 3, idempotencyKey: k2, reason: "b" }),
    ).rejects.toMatchObject({ status: 409 });
    const held = await db
      .select({ total: sql<number>`coalesce(sum(${budgetReservation.amountUsd}), 0)` })
      .from(budgetReservation)
      .where(and(eq(budgetReservation.projectId, p2), eq(budgetReservation.status, "HELD")));
    expect(Number(held[0]?.total ?? 0)).toBeLessThanOrEqual(5);
    await db.delete(costLedgerEntry).where(eq(costLedgerEntry.projectId, p2));
    await db.delete(budgetReservation).where(eq(budgetReservation.projectId, p2));
    await db.delete(project).where(eq(project.id, p2));
  });

  it("release writes RELEASE ledger entry and frees held amount", async () => {
    const key = `rel-${uuid()}`;
    const row = await cost.reserve(userId, projectId, { amountUsd: 2, idempotencyKey: key, reason: "release_test" });
    await cost.release(row.id, userId);
    const [updated] = await db.select().from(budgetReservation).where(eq(budgetReservation.id, row.id)).limit(1);
    expect(updated?.status).toBe("RELEASED");
    const releaseLedger = await db
      .select()
      .from(costLedgerEntry)
      .where(and(eq(costLedgerEntry.reservationId, row.id), eq(costLedgerEntry.entryType, "RELEASE")));
    expect(releaseLedger).toHaveLength(1);
  });
});
