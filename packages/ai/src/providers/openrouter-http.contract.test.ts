import { describe, expect, it } from "vitest";
import { normalizeHttpProviderError } from "./provider-http-errors.js";

describe("OpenRouter HTTP error normalization", () => {
  it("maps 401", () => {
    expect(normalizeHttpProviderError({ status: 401, providerId: "openrouter" }).code).toBe("INVALID_CREDENTIALS");
  });
  it("maps 429 retryable", () => {
    expect(normalizeHttpProviderError({ status: 429, providerId: "openrouter" }).retryable).toBe(true);
  });
  it("maps 503 retryable", () => {
    expect(normalizeHttpProviderError({ status: 503, providerId: "openrouter" }).code).toBe("PROVIDER_5XX");
  });
});
