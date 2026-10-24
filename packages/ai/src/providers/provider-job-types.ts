import type { ProviderJobStatus } from "./provider-job-state.js";

export type ProviderJobRow = {
  id: string;
  projectId: string;
  runId?: string | null;
  sceneId?: string | null;
  graphNodeId?: string | null;
  providerId: string;
  modelId: string;
  operation: string;
  status: ProviderJobStatus;
  providerJobId?: string | null;
  inputHash?: string | null;
  idempotencyKey?: string | null;
  attemptCount: number;
  version: number;
  submittedAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  failedAt?: Date | null;
  outputAssetIds: string[];
  estimatedCost?: string | null;
  actualUsage?: Record<string, unknown> | null;
  failureCode?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderJobStore = {
  findByIdempotency(projectId: string, key: string): Promise<ProviderJobRow | null>;
  get(id: string): Promise<ProviderJobRow | null>;
  insert(job: ProviderJobRow): Promise<void>;
  update(
    id: string,
    patch: Partial<ProviderJobRow> & { expectedVersion?: number },
  ): Promise<ProviderJobRow | null>;
  appendEvent(input: {
    id: string;
    providerJobId: string;
    eventType: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<boolean>;
  appendAttempt(input: {
    id: string;
    providerJobId: string;
    attemptNumber: number;
    status: string;
    requestPayload?: Record<string, unknown>;
    responsePayload?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
    completedAt?: Date;
  }): Promise<void>;
  listByProject(projectId: string, limit?: number, cursor?: string): Promise<ProviderJobRow[]>;
};
