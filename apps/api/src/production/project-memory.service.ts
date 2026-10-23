import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { projectMemory } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";

@Injectable()
export class ProjectMemoryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
  ) {}

  async get(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(projectMemory).where(eq(projectMemory.projectId, projectId)).limit(1);
    if (!row) {
      return {
        projectId,
        identity: {},
        brand: {},
        characters: [],
        visualStyle: {},
        preferences: {},
        userDecisions: [],
      };
    }
    return row;
  }

  async patch(userId: string, projectId: string, patch: Record<string, unknown>) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [existing] = await this.db.select().from(projectMemory).where(eq(projectMemory.projectId, projectId)).limit(1);
    if (!existing) {
      await this.db.insert(projectMemory).values({ projectId, ...patch });
    } else {
      await this.db
        .update(projectMemory)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(projectMemory.projectId, projectId));
    }
    return this.get(userId, projectId);
  }
}
