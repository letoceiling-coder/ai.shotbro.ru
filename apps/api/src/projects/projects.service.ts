import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq, ilike, isNull, isNotNull, lt, or } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Db } from "@shotbro/db/client";
import { conversation, project, workspace, workspaceMember } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly access: AccessPolicyService,
  ) {}

  async ensurePersonalWorkspace(userId: string, name: string) {
    const existing = await this.db
      .select()
      .from(workspaceMember)
      .innerJoin(workspace, eq(workspace.id, workspaceMember.workspaceId))
      .where(eq(workspaceMember.userId, userId))
      .limit(1);
    if (existing[0]) return existing[0].workspace;

    const wsId = uuid();
    await this.db.insert(workspace).values({ id: wsId, name, ownerId: userId });
    await this.db.insert(workspaceMember).values({ workspaceId: wsId, userId, role: "OWNER" });
    const [ws] = await this.db.select().from(workspace).where(eq(workspace.id, wsId)).limit(1);
    return ws!;
  }

  async list(
    userId: string,
    opts: { cursor?: string; limit?: number; q?: string; archived?: boolean } = {},
  ) {
    const { cursor, limit = 20, q, archived = false } = opts;
    const ws = await this.ensurePersonalWorkspace(userId, "Моё пространство");
    const conditions = [eq(project.workspaceId, ws.id), isNull(project.deletedAt)];
    if (archived) conditions.push(isNotNull(project.archivedAt));
    else conditions.push(isNull(project.archivedAt));
    if (q?.trim()) {
      conditions.push(or(ilike(project.title, `%${q.trim()}%`), ilike(project.description, `%${q.trim()}%`))!);
    }
    if (cursor) conditions.push(lt(project.updatedAt, new Date(cursor)));

    const rows = await this.db
      .select()
      .from(project)
      .where(and(...conditions))
      .orderBy(desc(project.updatedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: items.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        mode: "REAL" as const,
        updatedAt: p.updatedAt.toISOString(),
        archivedAt: p.archivedAt?.toISOString() ?? null,
      })),
      nextCursor: hasMore ? items[items.length - 1]!.updatedAt.toISOString() : null,
    };
  }

  async create(userId: string, title: string, description?: string) {
    const ws = await this.ensurePersonalWorkspace(userId, "Моё пространство");
    const id = uuid();
    const convId = uuid();
    await this.db.transaction(async (tx) => {
      await tx.insert(project).values({
        id,
        workspaceId: ws.id,
        ownerId: userId,
        title,
        description,
        status: "ACTIVE",
        mode: "REAL",
      });
      await tx.insert(conversation).values({ id: convId, projectId: id, title: "Основной диалог" });
    });
    const [row] = await this.db.select().from(project).where(eq(project.id, id)).limit(1);
    return row!;
  }

  async get(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    if (!row || row.deletedAt) throw new NotFoundException();
    return row;
  }

  async patch(userId: string, projectId: string, body: { title?: string; description?: string }) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.db
      .update(project)
      .set({
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(project.id, projectId));
    return this.get(userId, projectId);
  }

  async duplicate(userId: string, projectId: string) {
    const source = await this.get(userId, projectId);
    const id = uuid();
    const convId = uuid();
    await this.db.transaction(async (tx) => {
      await tx.insert(project).values({
        id,
        workspaceId: source.workspaceId,
        ownerId: userId,
        title: `${source.title} (копия)`,
        description: source.description,
        status: "ACTIVE",
        mode: "REAL",
        settings: source.settings ?? {},
      });
      await tx.insert(conversation).values({ id: convId, projectId: id, title: "Основной диалог" });
    });
    return this.get(userId, id);
  }

  async archive(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.db
      .update(project)
      .set({ archivedAt: new Date(), status: "ARCHIVED", updatedAt: new Date() })
      .where(eq(project.id, projectId));
    return this.get(userId, projectId);
  }

  async restore(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.db
      .update(project)
      .set({ archivedAt: null, status: "ACTIVE", updatedAt: new Date() })
      .where(eq(project.id, projectId));
    return this.get(userId, projectId);
  }

  async softDelete(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    await this.db
      .update(project)
      .set({ deletedAt: new Date(), status: "DELETED", updatedAt: new Date() })
      .where(eq(project.id, projectId));
    return { ok: true };
  }
}
