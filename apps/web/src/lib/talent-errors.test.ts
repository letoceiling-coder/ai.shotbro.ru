import { describe, expect, it } from "vitest";
import { ApiError } from "./api-client";
import { talentErrorMessage } from "./talent-errors";

describe("talentErrorMessage", () => {
  it("reads the server code and returns a Russian reason", () => {
    const err = new ApiError(400, undefined, { code: "consent_required" });
    expect(err.code).toBe("consent_required");
    expect(talentErrorMessage(err)).toMatch(/согласие/);
  });

  it("explains budget caps", () => {
    expect(talentErrorMessage(new ApiError(409, undefined, { code: "daily_cap_exceeded", message: "x" }))).toMatch(/дневной лимит/);
    expect(talentErrorMessage(new ApiError(409, undefined, { code: "run_cap_exceeded" }))).toMatch(/один запуск/);
  });

  it("handles rate limits and unknown errors", () => {
    expect(talentErrorMessage(new ApiError(429))).toMatch(/Слишком много/);
    expect(talentErrorMessage(new ApiError(400, undefined, { code: "something_new" }))).toContain("something_new");
  });
});
