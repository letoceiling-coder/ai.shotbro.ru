import { describe, expect, it } from "vitest";
import { ApiError, queryRetryDelay, shouldRetryQuery } from "./api-client";

describe("query retry policy", () => {
  it("retries rate limits and 5xx with backoff, up to 6 attempts", () => {
    expect(shouldRetryQuery(0, new ApiError(429))).toBe(true);
    expect(shouldRetryQuery(5, new ApiError(503))).toBe(true);
    expect(shouldRetryQuery(6, new ApiError(429))).toBe(false);
  });

  it("does not retry other 4xx (auth/forbidden/not found fail fast)", () => {
    for (const status of [400, 401, 403, 404, 409]) expect(shouldRetryQuery(0, new ApiError(status))).toBe(false);
  });

  it("honours Retry-After, otherwise exponential up to 15 s", () => {
    expect(queryRetryDelay(0, new ApiError(429, 7000))).toBe(7000);
    expect(queryRetryDelay(0, new ApiError(429))).toBe(1000);
    expect(queryRetryDelay(10, new ApiError(500))).toBe(15_000);
  });
});
