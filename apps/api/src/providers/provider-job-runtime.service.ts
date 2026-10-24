import { Inject, Injectable } from "@nestjs/common";
import { ProviderJobManager } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { DB } from "../database/database.module";
import { DrizzleProviderJobStore } from "./drizzle-provider-job.store";
import { ProviderJobEventBridgeService } from "./provider-job-event-bridge.service";

@Injectable()
export class ProviderJobRuntimeService {
  private readonly env = loadEnvFromProcess();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ProviderJobEventBridgeService) private readonly bridge: ProviderJobEventBridgeService,
  ) {}

  createManager(): ProviderJobManager {
    return new ProviderJobManager(this.env, new DrizzleProviderJobStore(this.db), this.bridge.lifecycleHook);
  }
}
