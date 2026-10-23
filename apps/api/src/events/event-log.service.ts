import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { eventLog, outboxEvent } from "@shotbro/db/schema";
import { DB } from "../database/database.module";

@Injectable()
export class EventLogService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async append(input: {
    workspaceId: string;
    projectId: string;
    type: string;
    resourceId?: string;
    payload: Record<string, unknown>;
  }) {
    const id = uuid();
    await this.db.transaction(async (tx) => {
      await tx.insert(eventLog).values({
        id,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        resourceId: input.resourceId,
        type: input.type,
        payload: input.payload,
      });
      await tx.insert(outboxEvent).values({
        id: uuid(),
        aggregateType: "project",
        aggregateId: input.projectId,
        type: input.type,
        payload: { eventId: id, ...input.payload },
      });
    });
    return id;
  }

  async listSince(projectId: string, afterId?: string, limit = 100) {
    let cursorRow: (typeof eventLog.$inferSelect) | undefined;
    if (afterId) {
      const [cursor] = await this.db.select().from(eventLog).where(eq(eventLog.id, afterId)).limit(1);
      if (!cursor) return [];
      cursorRow = cursor;
    }
    let rows = await this.db
      .select()
      .from(eventLog)
      .where(eq(eventLog.projectId, projectId))
      .orderBy(eventLog.createdAt)
      .limit(cursorRow ? limit + 50 : limit);
    if (cursorRow && afterId) {
      const cursorMs = cursorRow.createdAt.getTime();
      rows = rows.filter((r) => {
        if (r.id === afterId) return false;
        const ms = r.createdAt.getTime();
        return ms > cursorMs || (ms === cursorMs && r.id !== afterId);
      });
    }
    rows = rows.slice(0, limit);
    return rows.map((r) => ({
      eventId: r.id,
      type: r.type,
      projectId: r.projectId,
      resourceId: r.resourceId,
      timestamp: r.createdAt.toISOString(),
      payload: r.payload,
      schemaVersion: r.schemaVersion,
    }));
  }
}
