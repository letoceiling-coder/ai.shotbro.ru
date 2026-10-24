import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { project } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";

export type ProjectAgentSettings = {
  agentRuntimeV4?: boolean;
  agentRuntimeV4EnabledAt?: string;
  agentRuntimeV4EnabledBy?: string;
  agentRuntimeV4Audit?: Array<{ at: string; by: string; action: "enable" | "disable"; reason?: string }>;
};

@Injectable()
export class AgentRuntimeRolloutService {
  private readonly env = loadEnvFromProcess();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
  ) {}

  /** Resolved at run creation — stored on run metadata, never toggled mid-run. */
  resolveRuntimeVersion(projectSettings: ProjectAgentSettings | undefined): 3 | 4 {
    if (!projectSettings?.agentRuntimeV4) return 3;
    if (this.env.PHASE4_PROJECT_SCOPED_ENABLED) return 4;
    if (this.env.PHASE4_AGENT_RUNTIME_ENABLED) return 4;
    return 3;
  }

  async getRolloutStatus(userId: string, projectId: string) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    const settings = (row?.settings ?? {}) as ProjectAgentSettings;
    return {
      projectId,
      agentRuntimeV4: Boolean(settings.agentRuntimeV4),
      effectiveRuntime: this.resolveRuntimeVersion(settings),
      projectScopedEnabled: this.env.PHASE4_PROJECT_SCOPED_ENABLED,
      globalKillSwitch: !this.env.PHASE4_AGENT_RUNTIME_ENABLED && !this.env.PHASE4_PROJECT_SCOPED_ENABLED,
      mock: true,
    };
  }

  private adminEmails(): Set<string> {
    const raw = process.env.PHASE4_ROLLOUT_ADMIN_EMAILS ?? process.env.INTEGRATION_USER_A_EMAIL ?? "";
    return new Set(
      raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  assertRolloutAdmin(userEmail: string) {
    const allowed = this.adminEmails();
    if (!allowed.size || !allowed.has(userEmail.toLowerCase())) {
      throw new ForbiddenException("Agent runtime rollout is restricted to authorized operators");
    }
  }

  async setProjectRollout(input: {
    userId: string;
    userEmail: string;
    projectId: string;
    enable: boolean;
    reason?: string;
    via?: "admin" | "internal";
  }) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, input.userId, input.projectId);
    if (input.via !== "internal") {
      this.assertRolloutAdmin(input.userEmail);
    }
    if (!this.env.PHASE4_PROJECT_SCOPED_ENABLED && input.via !== "internal") {
      throw new ForbiddenException("Project-scoped AgentRuntime is disabled on this environment");
    }

    const [row] = await this.db.select().from(project).where(eq(project.id, input.projectId)).limit(1);
    if (!row) throw new ForbiddenException();
    const prev = (row.settings ?? {}) as ProjectAgentSettings;
    const audit = [...(prev.agentRuntimeV4Audit ?? [])].slice(-20);
    const at = new Date().toISOString();
    audit.push({
      at,
      by: input.userId,
      action: input.enable ? "enable" : "disable",
      reason: input.reason,
    });
    const settings: ProjectAgentSettings = {
      ...prev,
      agentRuntimeV4: input.enable,
      agentRuntimeV4EnabledAt: input.enable ? at : prev.agentRuntimeV4EnabledAt,
      agentRuntimeV4EnabledBy: input.enable ? input.userId : prev.agentRuntimeV4EnabledBy,
      agentRuntimeV4Audit: audit,
    };
    await this.db
      .update(project)
      .set({ settings, updatedAt: new Date() })
      .where(eq(project.id, input.projectId));

    await this.events.append({
      workspaceId,
      projectId: input.projectId,
      type: "agent.runtime.rollout.changed",
      resourceId: input.projectId,
      payload: {
        projectId: input.projectId,
        enable: input.enable,
        by: input.userId,
        via: input.via ?? "admin",
        reason: input.reason,
        mock: true,
      },
    });

    return this.getRolloutStatus(input.userId, input.projectId);
  }
}
