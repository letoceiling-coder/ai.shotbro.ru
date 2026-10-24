import { describe, expect, it } from "vitest";
import { Phase4MockImageProvider } from "./mock-image-provider.js";
import { ProviderJobManager } from "./provider-job-manager.js";
import type { ProviderJobRow, ProviderJobStore } from "./provider-job-types.js";

class MemoryProviderJobStore implements ProviderJobStore {
  private jobs = new Map<string, ProviderJobRow>();
  private idem = new Map<string, string>();

  async findByIdempotency(projectId: string, key: string) {
    const id = this.idem.get(`${projectId}:${key}`);
    return id ? this.jobs.get(id)! : null;
  }
  async get(id: string) {
    return this.jobs.get(id) ?? null;
  }
  async insert(job: ProviderJobRow) {
    this.jobs.set(job.id, job);
    if (job.idempotencyKey) this.idem.set(`${job.projectId}:${job.idempotencyKey}`, job.id);
  }
  async update(id: string, patch: Partial<ProviderJobRow> & { expectedVersion?: number }) {
    const cur = this.jobs.get(id);
    if (!cur) return null;
    if (patch.expectedVersion != null && patch.expectedVersion !== cur.version) return null;
    const next = { ...cur, ...patch, version: cur.version + 1 };
    this.jobs.set(id, next as ProviderJobRow);
    return next as ProviderJobRow;
  }
  async appendEvent() {
    return true;
  }
  async appendAttempt() {}
  async listByProject(projectId: string) {
    return [...this.jobs.values()].filter((j) => j.projectId === projectId);
  }
}

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  OPENROUTER_ALLOW_PAID_REQUESTS: false,
} as import("@shotbro/config/env").AppEnv;

describe("ProviderJobManager", () => {
  it("completes mock image job without network", async () => {
    const store = new MemoryProviderJobStore();
    const manager = new ProviderJobManager(env, store);
    const job = await manager.submitWithAdapter(new Phase4MockImageProvider(), {
      id: "job-1",
      projectId: "proj-1",
      providerId: "mock-image",
      modelId: "mock/image",
      operation: "TEXT_TO_IMAGE",
      idempotencyKey: "k1",
      input: { prompt: "frame" },
      userId: "u1",
    });
    expect(job.status).toBe("COMPLETED");
  });
});
