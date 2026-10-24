import { getFalConfig } from "@shotbro/config/vendor-providers";
import type { AppEnv } from "@shotbro/config/env";
import { ExecutionPolicyEngine } from "../execution/execution-policy-engine.js";
import type { HttpTransport } from "./http-transport.js";
import { BlockedHttpTransport } from "./http-transport.js";
import { normalizeHttpProviderError, mapTransportError } from "./provider-http-errors.js";
import type { NormalizedProviderError } from "./provider-contracts.js";

export type FalSubmitResponse = {
  request_id: string;
  status_url?: string;
  response_url?: string;
  cancel_url?: string;
  queue_position?: number;
};

export type FalStatusResponse = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
  request_id: string;
  response_url?: string | null;
  error?: string | null;
};

export type FalResultResponse = {
  images?: Array<{ url: string; width?: number; height?: number }>;
  video?: { url: string };
  image?: { url: string };
};

/** Fal queue REST client (https://fal.ai/docs/api-reference/inference-api). */
export class FalQueueClient {
  private readonly policy: ExecutionPolicyEngine;

  constructor(
    private readonly env: AppEnv,
    private readonly http: HttpTransport = new BlockedHttpTransport(),
  ) {
    this.policy = new ExecutionPolicyEngine(env);
  }

  async submit(modelPath: string, body: Record<string, unknown>, timeoutMs = 120_000): Promise<FalSubmitResponse> {
    this.policy.assertProviderNetworkCall();
    const cfg = getFalConfig(this.env);
    const res = await this.http.request({
      method: "POST",
      url: `${cfg.queueBaseUrl}/${modelPath}`,
      headers: {
        Authorization: cfg.hasApiKey ? `Key ${this.env.FAL_API_KEY}` : "",
        "Content-Type": "application/json",
      },
      body,
      timeoutMs,
    });
    if (res.status >= 400) {
      throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: "fal" });
    }
    return res.body as FalSubmitResponse;
  }

  async getStatus(statusUrl: string, timeoutMs = 30_000): Promise<FalStatusResponse> {
    this.policy.assertProviderNetworkCall();
    const cfg = getFalConfig(this.env);
    const res = await this.http.request({
      method: "GET",
      url: statusUrl.includes("://") ? statusUrl : `${cfg.queueBaseUrl}${statusUrl}`,
      headers: {
        Authorization: cfg.hasApiKey ? `Key ${this.env.FAL_API_KEY}` : "",
      },
      timeoutMs,
    });
    if (res.status >= 400) {
      throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: "fal" });
    }
    return res.body as FalStatusResponse;
  }

  async getResult(responseUrl: string, timeoutMs = 60_000): Promise<FalResultResponse> {
    this.policy.assertProviderNetworkCall();
    const cfg = getFalConfig(this.env);
    const res = await this.http.request({
      method: "GET",
      url: responseUrl.includes("://") ? responseUrl : `${cfg.queueBaseUrl}${responseUrl}`,
      headers: {
        Authorization: cfg.hasApiKey ? `Key ${this.env.FAL_API_KEY}` : "",
      },
      timeoutMs,
    });
    if (res.status >= 400) {
      throw normalizeHttpProviderError({ status: res.status, body: res.body, providerId: "fal" });
    }
    return res.body as FalResultResponse;
  }

  mapError(err: unknown): NormalizedProviderError {
    if (typeof err === "object" && err !== null && "code" in err) {
      return err as NormalizedProviderError;
    }
    return mapTransportError(err, "fal");
  }
}
