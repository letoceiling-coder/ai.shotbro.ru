import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { conversation } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";

@Injectable()
export class ConversationsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessPolicyService,
  ) {}

  async listForProject(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    return this.db.select().from(conversation).where(eq(conversation.projectId, projectId));
  }

  async create(userId: string, projectId: string, title?: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const id = uuid();
    await this.db.insert(conversation).values({ id, projectId, title: title ?? "Диалог" });
    const [row] = await this.db.select().from(conversation).where(eq(conversation.id, id)).limit(1);
    return row!;
  }

  async get(userId: string, conversationId: string) {
    const [row] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
    if (!row) throw new NotFoundException();
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    return row;
  }
}
