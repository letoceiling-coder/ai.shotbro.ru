import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { conversation, message, messageAttachment, messageBlock } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";
import { IdempotencyService } from "../common/idempotency.service";

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  async list(userId: string, conversationId: string, cursor?: string, limit = 50) {
    const [conv] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
    if (!conv) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, conv.projectId);

    const conditions = [eq(message.conversationId, conversationId), isNull(message.deletedAt)];
    if (cursor) conditions.push(lt(message.createdAt, new Date(cursor)));

    const rows = await this.db
      .select()
      .from(message)
      .where(and(...conditions))
      .orderBy(desc(message.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const items = await Promise.all(
      slice.map(async (m) => {
        const blocks = await this.db.select().from(messageBlock).where(eq(messageBlock.messageId, m.id));
        const attachments = await this.db
          .select()
          .from(messageAttachment)
          .where(eq(messageAttachment.messageId, m.id));
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          blocks: blocks.map((b) => ({ type: b.type, ...b.payload })),
          attachments: attachments.map((a) => ({ assetId: a.assetId })),
        };
      }),
    );

    return {
      items: items.reverse(),
      nextCursor: hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null,
    };
  }

  /** User messages only — no assistant auto-reply in Phase 2 */
  async createUserMessage(
    userId: string,
    conversationId: string,
    input: { content: string; attachmentAssetIds?: string[]; idempotencyKey?: string },
  ) {
    return this.idempotency.run(input.idempotencyKey, userId, `message:create:${conversationId}`, async () => {
      const [conv] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      if (!conv) throw new NotFoundException();
      const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, conv.projectId);

      const id = uuid();
      await this.db.insert(message).values({
        id,
        conversationId,
        projectId: conv.projectId,
        role: "user",
        content: input.content,
        status: "sent",
      });

      if (input.attachmentAssetIds?.length) {
        await this.db.insert(messageAttachment).values(
          input.attachmentAssetIds.map((assetId, position) => ({
            id: uuid(),
            messageId: id,
            assetId,
            position,
          })),
        );
      }

      await this.events.append({
        workspaceId,
        projectId: conv.projectId,
        type: "message.created",
        resourceId: id,
        payload: { messageId: id, role: "user" },
      });

      return { id, role: "user" as const, content: input.content, conversationId };
    });
  }
}
