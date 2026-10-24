import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import type { ProviderJobLifecycleEvent } from "@shotbro/ai";
import type { Db } from "@shotbro/db/client";
import { project } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { EventLogService } from "../events/event-log.service";

@Injectable()
export class ProviderJobEventBridgeService {
  private readonly log = new Logger(ProviderJobEventBridgeService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(EventLogService) private readonly events: EventLogService,
  ) {}

  lifecycleHook = async (ev: ProviderJobLifecycleEvent) => {
    const [proj] = await this.db.select().from(project).where(eq(project.id, ev.job.projectId)).limit(1);
    if (!proj) return;

    const type = ev.to === "CREATED" ? "provider.job.created" : "provider.job.status";
    const dedupeId =
      ev.to === "CREATED" ? `${ev.job.id}:created` : `${ev.job.id}:status:${ev.to}:${ev.job.version}`;

    try {
      await this.events.append({
        id: dedupeId,
        workspaceId: proj.workspaceId,
        projectId: ev.job.projectId,
        resourceId: ev.job.id,
        type,
        payload: {
          providerJobId: ev.job.id,
          from: ev.from,
          to: ev.to,
          status: ev.to,
          version: ev.job.version,
          providerId: ev.job.providerId,
          modelId: ev.job.modelId,
          operation: ev.job.operation,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "event_append_failed";
      if (!/duplicate|unique|primary/i.test(msg)) {
        this.log.warn(`ProviderJob SSE append failed: ${msg}`);
      }
    }
  };
}
