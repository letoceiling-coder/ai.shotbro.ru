import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "@shotbro/db/client";
import { idempotencyRecord } from "@shotbro/db/schema";
import { DB } from "../database/database.module";

@Injectable()
export class IdempotencyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async run<T extends Record<string, unknown>>(
    key: string | undefined,
    userId: string,
    route: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    if (!key) return handler();

    const existing = await this.db.select().from(idempotencyRecord).where(eq(idempotencyRecord.key, key)).limit(1);
    const row = existing[0];
    if (row) {
      if (row.userId !== userId || row.route !== route) throw new ConflictException("Idempotency key conflict");
      if (row.responseBody) return row.responseBody as T;
      throw new ConflictException("Request in progress");
    }

    const result = await handler();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    await this.db.insert(idempotencyRecord).values({
      key,
      userId,
      route,
      responseHash: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
      responseBody: result,
      expiresAt,
    });
    return result;
  }
}
