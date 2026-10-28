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

  /**
   * Claim key before handler runs so concurrent duplicates get 409 instead of double side effects.
   * On handler failure the claim is removed so clients may retry with the same key.
   */
  async runWithClaim<T extends Record<string, unknown>>(
    key: string | undefined,
    userId: string,
    route: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    if (!key) return handler();

    const existing = await this.findRow(key);
    if (existing) {
      this.assertRowOwner(existing, userId, route);
      if (existing.responseBody) return existing.responseBody as T;
      throw new ConflictException("Request in progress");
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
    try {
      await this.db.insert(idempotencyRecord).values({
        key,
        userId,
        route,
        responseHash: null,
        responseBody: null,
        expiresAt,
      });
    } catch {
      const raced = await this.findRow(key);
      if (raced) {
        this.assertRowOwner(raced, userId, route);
        if (raced.responseBody) return raced.responseBody as T;
      }
      throw new ConflictException("Request in progress");
    }

    try {
      const result = await handler();
      await this.db
        .update(idempotencyRecord)
        .set({
          responseHash: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
          responseBody: result,
        })
        .where(eq(idempotencyRecord.key, key));
      return result;
    } catch (e) {
      await this.db.delete(idempotencyRecord).where(eq(idempotencyRecord.key, key));
      throw e;
    }
  }

  private async findRow(key: string) {
    const rows = await this.db.select().from(idempotencyRecord).where(eq(idempotencyRecord.key, key)).limit(1);
    return rows[0];
  }

  private assertRowOwner(row: { userId: string; route: string }, userId: string, route: string) {
    if (row.userId !== userId || row.route !== route) throw new ConflictException("Idempotency key conflict");
  }
}
