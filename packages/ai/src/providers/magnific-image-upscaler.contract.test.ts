import { describe, expect, it } from "vitest";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { MockHttpTransport } from "./http-transport.js";
import {
  MagnificImageUpscalerAdapter,
  MagnificUpscaleRequestSchema,
} from "./magnific-image-upscaler-adapter.js";

const env = { ...loadEnvFromProcess(), MAGNIFIC_API_KEY: "test-key-mock" };

describe("MagnificImageUpscalerAdapter contract", () => {
  it("serializes auth header and body for POST /v1/ai/image-upscaler", async () => {
    let captured: { headers?: Record<string, string>; body?: unknown } = {};
    const transport = new MockHttpTransport({
      "POST https://api.magnific.com/v1/ai/image-upscaler": {
        status: 200,
        headers: {},
        body: {
          data: { task_id: "task-1", status: "IN_PROGRESS", generated: [] },
        },
      },
    });
    transport.request = async (req) => {
      captured = { headers: req.headers, body: req.body };
      return {
        status: 200,
        headers: {},
        body: { data: { task_id: "task-1", status: "IN_PROGRESS", generated: [] } },
      };
    };
    const adapter = new MagnificImageUpscalerAdapter(env, transport);
    const input = MagnificUpscaleRequestSchema.parse({
      image: "base64payload",
      scale_factor: "4x",
      optimized_for: "films_n_photography",
      creativity: -3,
      engine: "magnific_sparkle",
    });
    const res = await adapter.submit(MagnificImageUpscalerAdapter.modelId, "IMAGE_UPSCALE", input, {
      idempotencyKey: "k1",
    });
    expect(res.providerJobId).toBe("task-1");
    expect(captured.headers?.["x-magnific-api-key"]).toBe("test-key-mock");
    expect(captured.body).toMatchObject({ scale_factor: "4x", engine: "magnific_sparkle" });
  });

  it("rejects invalid creativity range", () => {
    expect(() =>
      MagnificUpscaleRequestSchema.parse({ image: "x", creativity: 11 }),
    ).toThrow();
  });

  it("maps 401 to non-retryable auth error", async () => {
    const transport = new MockHttpTransport({});
    transport.request = async () => ({ status: 401, headers: {}, body: {} });
    const adapter = new MagnificImageUpscalerAdapter(env, transport);
    await expect(
      adapter.submit(
        MagnificImageUpscalerAdapter.modelId,
        "IMAGE_UPSCALE",
        { image: "x" },
        { idempotencyKey: "k2" },
      ),
    ).rejects.toMatchObject({ code: "auth_failed" });
  });

  it("blocked transport surfaces execution_blocked", async () => {
    const adapter = new MagnificImageUpscalerAdapter(env);
    await expect(
      adapter.submit(
        MagnificImageUpscalerAdapter.modelId,
        "IMAGE_UPSCALE",
        { image: "x" },
        { idempotencyKey: "k3" },
      ),
    ).rejects.toMatchObject({ code: "execution_blocked" });
  });
});
