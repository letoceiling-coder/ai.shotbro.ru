import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { inArray } from "drizzle-orm";
import type { Db } from "@shotbro/db/client";
import { providerJob } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { DrizzleProviderJobStore } from "./drizzle-provider-job.store";
import { ProviderJobsService } from "./provider-jobs.service";
import { ProviderJobRuntimeService } from "./provider-job-runtime.service";

const POLL_MS = 15_000;
const ACTIVE = ["SUBMITTED", "QUEUED", "RUNNING"] as const;

@Injectable()
export class ProviderJobSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ProviderJobSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ProviderJobsService) private readonly jobs: ProviderJobsService,
    @Inject(ProviderJobRuntimeService) private readonly runtime: ProviderJobRuntimeService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_PROVIDER_JOB_SCHEDULER === "1") return;
    this.timer = setInterval(() => {
      void this.tick().catch((e) => this.log.warn(e instanceof Error ? e.message : "tick failed"));
    }, POLL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const rows = await this.db
      .select()
      .from(providerJob)
      .where(inArray(providerJob.status, [...ACTIVE]))
      .limit(20);
    if (!rows.length) return;
    const manager = this.runtime.createManager();
    for (const row of rows) {
      if (row.status === "SUBMITTED" || row.status === "QUEUED") {
        await manager.transition(row.id, "RUNNING");
        await manager.transition(row.id, "COMPLETED", {
          outputAssetIds: row.outputAssetIds ?? [],
        });
        await this.jobs.ingestMockOutputsIfNeeded(await new DrizzleProviderJobStore(this.db).get(row.id));
      }
    }
  }
}
