import { describe, expect, it } from "vitest";
import { MockHttpTransport } from "./http-transport.js";
import { FalMinimaxH3VideoAdapter } from "./fal-minimax-video-adapter.js";

const baseEnv = {
  AI_MOCK_MODE: false,
  PROVIDER_LIVE_EXECUTION_ENABLED: true,
  FAL_API_KEY: "fal-test-key-12345678",
} as import("@shotbro/config/env").AppEnv;

describe("FalMinimaxH3VideoAdapter contract (mock transport)", () => {
  it("submits async job fixture", async () => {
    const transport = new MockHttpTransport({
      "POST https://queue.fal.run/minimax/h3/text-to-video": {
        status: 200,
        headers: {},
        body: { request_id: "vid-1", status_url: "https://queue.fal.run/minimax/h3/requests/vid-1/status" },
      },
    });
    const adapter = new FalMinimaxH3VideoAdapter(baseEnv, transport);
    const result = await adapter.submit(
      FalMinimaxH3VideoAdapter.modelId,
      "TEXT_TO_VIDEO",
      { prompt: "kitten" },
      { idempotencyKey: "k1" },
    );
    expect(result.status).toBe("SUBMITTED");
  });

  it("parseResult missing video → unknown output", () => {
    const adapter = new FalMinimaxH3VideoAdapter(baseEnv, new MockHttpTransport({}));
    expect(adapter.parseResult({}).status).toBe("SUBMITTED");
  });
});
