import { createHash } from "node:crypto";
import { assertProviderJobTransition, isTerminalProviderJobStatus, type ProviderJobStatus } from "./provider-job-state.js";
import type { ProviderJobRow, ProviderJobStore } from "./provider-job-types.js";
import type { MediaProviderAdapter, ProviderSubmitResult } from "./provider-contracts.js";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type { AppEnv } from "@shotbro/config/env";

export type SubmitProviderJobInput = {
  id: string;
  projectId: string;
  runId?: string;
  sceneId?: string;
  graphNodeId?: string;
  providerId: string;
  modelId: string;
  operation: string;
  idempotencyKey: string;
  input: Record<string, unknown>;
  estimatedCostUsd?: number;
  userId: string;
};

export class ProviderJobManager {
  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly store: ProviderJobStore,
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  async submitWithAdapter(adapter: MediaProviderAdapter, input: SubmitProviderJobInput): Promise<ProviderJobRow> {
    if (input.idempotencyKey) {
      const existing = await this.store.findByIdempotency(input.projectId, input.idempotencyKey);
      if (existing) return existing;
    }

    const inputHash = createHash("sha256").update(JSON.stringify(input.input)).digest("hex");
    const now = new Date();
    const job: ProviderJobRow = {
      id: input.id,
      projectId: input.projectId,
      runId: input.runId,
      sceneId: input.sceneId,
      graphNodeId: input.graphNodeId,
      providerId: input.providerId,
      modelId: input.modelId,
      operation: input.operation,
      status: "CREATED",
      inputHash,
      idempotencyKey: input.idempotencyKey,
      attemptCount: 0,
      version: 1,
      outputAssetIds: [],
      estimatedCost: input.estimatedCostUsd?.toFixed(4),
      metadata: { mock: true, userId: input.userId },
      createdAt: now,
      updatedAt: now,
    };
    await this.store.insert(job);
    await this.store.appendEvent({
      id: `${input.id}:evt:created`,
      providerJobId: input.id,
      eventType: "provider.job.created",
      idempotencyKey: `${input.id}:created`,
    });

    await this.transition(job.id, "AUTHORIZED");
    adapter.validateRequest(input.modelId, input.operation, input.input);

    await this.transition(job.id, "SUBMITTING");
    adapter.validateRequest(input.modelId, input.operation, input.input);

    const mode = this.policy.resolveMode();
    const result =
      mode === "LIVE_APPROVED"
        ? await adapter.submit(input.modelId, input.operation, input.input, {
            idempotencyKey: input.idempotencyKey,
          })
        : await this.simulateMockSubmit(adapter, input);

    return this.applySubmitResult(job.id, result);
  }

  /** Mock-only path when live network is blocked. */
  private async simulateMockSubmit(
    adapter: MediaProviderAdapter,
    input: SubmitProviderJobInput,
  ): Promise<ProviderSubmitResult> {
    adapter.validateRequest(input.modelId, input.operation, input.input);
    return {
      status: "COMPLETED",
      providerJobId: `mock-${input.id.slice(0, 8)}`,
      outputs: [{ mock: true, mimeType: "application/octet-stream" }],
      usage: { mock: true, units: 1 },
    };
  }

  async transition(jobId: string, to: ProviderJobStatus, patch: Partial<ProviderJobRow> = {}): Promise<ProviderJobRow> {
    const current = await this.store.get(jobId);
    if (!current) throw new Error("Provider job not found");
    assertProviderJobTransition(current.status, to);
    const now = new Date();
    const updated = await this.store.update(jobId, {
      ...patch,
      status: to,
      version: current.version + 1,
      expectedVersion: current.version,
      updatedAt: now,
      submittedAt: to === "SUBMITTED" ? now : current.submittedAt,
      startedAt: to === "RUNNING" ? now : current.startedAt,
      completedAt: to === "COMPLETED" ? now : current.completedAt,
      failedAt: to === "FAILED" ? now : current.failedAt,
    });
    if (!updated) throw new Error("Provider job version conflict");
    await this.store.appendEvent({
      id: `${jobId}:evt:${to}:${updated.version}`,
      providerJobId: jobId,
      eventType: "provider.job.status",
      payload: { from: current.status, to },
      idempotencyKey: `${jobId}:status:${to}:${updated.version}`,
    });
    return updated;
  }

  async markUnknownResult(jobId: string): Promise<ProviderJobRow> {
    const row = await this.store.get(jobId);
    if (!row) throw new Error("Provider job not found");
    if (isTerminalProviderJobStatus(row.status)) return row;
    return this.transition(jobId, "NEEDS_RECONCILIATION");
  }

  private async applySubmitResult(jobId: string, result: ProviderSubmitResult): Promise<ProviderJobRow> {
    if (result.status === "SUBMITTED") {
      await this.transition(jobId, "SUBMITTED", { providerJobId: result.providerJobId ?? undefined });
      return (await this.store.get(jobId))!;
    }
    await this.transition(jobId, "SUBMITTED", { providerJobId: result.providerJobId ?? undefined });
    await this.transition(jobId, "RUNNING");
    await this.transition(jobId, "COMPLETED", {
      actualUsage: result.usage,
      outputAssetIds: result.outputs?.map((o) => o.assetId).filter(Boolean) as string[] | undefined,
    });
    return (await this.store.get(jobId))!;
  }
}
