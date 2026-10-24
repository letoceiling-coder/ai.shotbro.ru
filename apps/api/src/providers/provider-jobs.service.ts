import { Inject, Injectable } from "@nestjs/common";
import { v4 as uuid } from "uuid";
import {
  Phase4MockElevenLabsProvider,
  Phase4MockImageProvider,
  Phase4MockVideoProvider,
  ProviderJobManager,
} from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { providerJob } from "@shotbro/db/schema";
import { eq } from "drizzle-orm";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { DrizzleProviderJobStore } from "./drizzle-provider-job.store";

@Injectable()
export class ProviderJobsService {
  private readonly env = loadEnvFromProcess();
  private readonly image = new Phase4MockImageProvider();
  private readonly video = new Phase4MockVideoProvider();
  private readonly audio = new Phase4MockElevenLabsProvider();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
  ) {}

  private manager() {
    return new ProviderJobManager(this.env, new DrizzleProviderJobStore(this.db));
  }

  async listForProject(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const store = new DrizzleProviderJobStore(this.db);
    const items = await store.listByProject(projectId, 50);
    return { items, mock: true };
  }

  async submitMockFromTool(input: {
    userId: string;
    projectId: string;
    runId: string;
    toolName: string;
    operation: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }) {
    await this.access.assertProjectAccess(this.db, input.userId, input.projectId);
    const manager = this.manager();
    const adapter =
      input.toolName === "generate.image"
        ? this.image
        : input.toolName === "generate.video"
          ? this.video
          : this.audio;
    const job = await manager.submitWithAdapter(adapter, {
      id: uuid(),
      projectId: input.projectId,
      runId: input.runId,
      providerId: adapter.providerId,
      modelId: `mock/${adapter.modality}`,
      operation: input.operation,
      idempotencyKey: input.idempotencyKey,
      input: input.payload,
      userId: input.userId,
    });
    return { providerJobId: job.id, status: job.status };
  }

  async applyWebhookEvent(
    providerId: string,
    event: { eventId: string; providerJobId: string; status: "COMPLETED" | "FAILED" | "RUNNING"; timestamp: number },
  ): Promise<boolean> {
    const store = new DrizzleProviderJobStore(this.db);
    const job = await store.get(event.providerJobId);
    if (!job || job.providerId !== providerId) return false;
    const appended = await store.appendEvent({
      id: event.eventId,
      providerJobId: job.id,
      eventType: "webhook",
      payload: { status: event.status, timestamp: event.timestamp },
      idempotencyKey: event.eventId,
    });
    if (!appended) return false;
    const manager = this.manager();
    if (event.status === "RUNNING") await manager.transition(job.id, "RUNNING");
    if (event.status === "COMPLETED") {
      if (job.status !== "COMPLETED") {
        if (job.status === "SUBMITTED" || job.status === "QUEUED") await manager.transition(job.id, "RUNNING");
        await manager.transition(job.id, "COMPLETED");
      }
    }
    if (event.status === "FAILED") await manager.transition(job.id, "FAILED");
    return true;
  }

  async getJobForProject(userId: string, projectId: string, jobId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db
      .select()
      .from(providerJob)
      .where(eq(providerJob.id, jobId))
      .limit(1);
    if (!row || row.projectId !== projectId) return null;
    return row;
  }
}
