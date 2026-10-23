import { ForbiddenException, Injectable } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { project, workspaceMember } from "@shotbro/db/schema";

@Injectable()
export class AccessPolicyService {
  async assertProjectAccess(db: Db, userId: string, projectId: string): Promise<{ workspaceId: string }> {
    const rows = await db
      .select({
        workspaceId: project.workspaceId,
        ownerId: project.ownerId,
      })
      .from(project)
      .where(and(eq(project.id, projectId)))
      .limit(1);

    const row = rows[0];
    if (!row) throw new ForbiddenException("Project not found");

    if (row.ownerId === userId) return { workspaceId: row.workspaceId };

    const member = await db
      .select()
      .from(workspaceMember)
      .where(and(eq(workspaceMember.workspaceId, row.workspaceId), eq(workspaceMember.userId, userId)))
      .limit(1);

    if (!member[0]) throw new ForbiddenException("Access denied");
    return { workspaceId: row.workspaceId };
  }
}
