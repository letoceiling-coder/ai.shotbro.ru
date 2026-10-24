export type ProviderJobStatus = "SUBMITTED" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "NEEDS_RECONCILIATION";

export type ProviderJobRecord = {
  id: string;
  idempotencyKey?: string;
  providerJobId?: string;
  internalJobId: string;
  projectId: string;
  runId?: string;
  sceneId?: string;
  modelId: string;
  providerId: string;
  status: ProviderJobStatus;
  attempts: number;
  outputRefs: string[];
  submittedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
};

export type ProviderJobStore = {
  findByIdempotency(key: string): Promise<ProviderJobRecord | null>;
  save(job: ProviderJobRecord): Promise<void>;
  get(id: string): Promise<ProviderJobRecord | null>;
};

export class ProviderJobManager {
  constructor(private readonly store: ProviderJobStore) {}

  async submit(input: Omit<ProviderJobRecord, "updatedAt">): Promise<ProviderJobRecord> {
    if (input.idempotencyKey) {
      const existing = await this.store.findByIdempotency(input.idempotencyKey);
      if (existing) return existing;
    }
    const job: ProviderJobRecord = { ...input, updatedAt: new Date() };
    await this.store.save(job);
    return job;
  }

  async markUnknownResult(jobId: string): Promise<void> {
    const job = await this.store.get(jobId);
    if (!job) return;
    job.status = "NEEDS_RECONCILIATION";
    job.updatedAt = new Date();
    await this.store.save(job);
  }
}
