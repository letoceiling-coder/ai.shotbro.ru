import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { FalFluxDevImageAdapter } from "./fal-flux-image-adapter.js";

const env = {
  AI_MOCK_MODE: true,
  PROVIDER_LIVE_EXECUTION_ENABLED: false,
  FAL_API_KEY: "fal-test-key-12345678",
} as import("@shotbro/config/env").AppEnv;

describe("FalFluxDevImageAdapter contract (mock transport)", () => {
  it("blocks network when execution policy is MOCK_ONLY", async () => {
    const transport = new MockHttpTransport({});
    const adapter = new FalFluxDevImageAdapter(env, transport);
    await expect(
      adapter.submit(FalFluxDevImageAdapter.modelId, "TEXT_TO_IMAGE", { prompt: "sunset" }, {
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(/blocked|MOCK_ONLY/i);
  });

  it("maps successful queue submit fixture", async () => {
    const liveEnv = {
      ...env,
      AI_MOCK_MODE: false,
      PROVIDER_LIVE_EXECUTION_ENABLED: true,
    } as import("@shotbro/config/env").AppEnv;
    const transport = new MockHttpTransport({
      "POST https://queue.fal.run/fal-ai/flux/dev": {
        status: 200,
        headers: {},
        body: {
          request_id: "req-flux-1",
          status_url: "https://queue.fal.run/fal-ai/flux/requests/req-flux-1/status",
          response_url: "https://queue.fal.run/fal-ai/flux/requests/req-flux-1",
        },
      },
    });
    const adapter = new FalFluxDevImageAdapter(liveEnv, transport);
    const result = await adapter.submit(
      FalFluxDevImageAdapter.modelId,
      "TEXT_TO_IMAGE",
      { prompt: "sunset" },
      { idempotencyKey: "k2" },
    );
    expect(result.status).toBe("SUBMITTED");
    expect(result.providerJobId).toBe("req-flux-1");
  });

  it("maps 429 as retryable", async () => {
    const liveEnv = {
      ...env,
      AI_MOCK_MODE: false,
      PROVIDER_LIVE_EXECUTION_ENABLED: true,
    } as import("@shotbro/config/env").AppEnv;
    const transport = new MockHttpTransport({
      "POST https://queue.fal.run/fal-ai/flux/dev": { status: 429, headers: {}, body: { error: "rate" } },
    });
    const adapter = new FalFluxDevImageAdapter(liveEnv, transport);
    await expect(
      adapter.submit(FalFluxDevImageAdapter.modelId, "TEXT_TO_IMAGE", { prompt: "x" }, { idempotencyKey: "k3" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", retryable: true });
  });

  it("parseResult handles missing output", () => {
    const adapter = new FalFluxDevImageAdapter(env, new MockHttpTransport({}));
    expect(adapter.parseResult({ images: [] }).status).toBe("SUBMITTED");
  });
});
