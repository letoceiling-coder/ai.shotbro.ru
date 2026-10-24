import type { AppEnv } from "@shotbro/config/env";
import { getAiExecutionConfig } from "@shotbro/config";

export type ExecutionMode = "MOCK_ONLY" | "LIVE_CONFIGURED_DISABLED" | "LIVE_APPROVED";

export type ExecutionAuthorizationContext = {
  userId: string;
  projectId: string;
  runId?: string;
  approvedMaxCostUsd?: number;
  productionApproved?: boolean;
  idempotencyKey?: string;
};

export class ExecutionPolicyEngine {
  constructor(private readonly env: AppEnv) {}

  resolveMode(): ExecutionMode {
    const cfg = getAiExecutionConfig(this.env);
    if (cfg.mockMode) return "MOCK_ONLY";
    if (!cfg.liveProviderExecutionEnabled) return "LIVE_CONFIGURED_DISABLED";
    return "LIVE_APPROVED";
  }

  assertLlmAllowed(mode: ExecutionMode = this.resolveMode()): void {
    if (mode === "MOCK_ONLY" || mode === "LIVE_CONFIGURED_DISABLED") {
      return;
    }
    this.assertLiveApproved({});
  }

  assertProviderNetworkCall(mode: ExecutionMode = this.resolveMode()): void {
    if (mode !== "LIVE_APPROVED") {
      throw new Error(`Provider network I/O blocked (${mode})`);
    }
  }

  assertLiveApproved(ctx: Partial<ExecutionAuthorizationContext>): void {
    const mode = this.resolveMode();
    if (mode !== "LIVE_APPROVED") {
      throw new Error(`Live execution blocked (${mode})`);
    }
    if (!ctx.userId || !ctx.projectId) {
      throw new Error("Live execution requires authenticated project context");
    }
    if (!ctx.productionApproved) {
      throw new Error("Live execution requires production approval");
    }
    if (ctx.approvedMaxCostUsd == null || ctx.approvedMaxCostUsd <= 0) {
      throw new Error("Live execution requires approved maximum cost");
    }
  }
}
