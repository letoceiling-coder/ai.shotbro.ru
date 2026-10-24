import { describe, expect, it } from "vitest";
import { assertProviderJobTransition, isTerminalProviderJobStatus } from "./provider-job-state.js";

describe("provider job state machine", () => {
  it("allows CREATED → AUTHORIZED", () => {
    expect(() => assertProviderJobTransition("CREATED", "AUTHORIZED")).not.toThrow();
  });

  it("blocks COMPLETED → RUNNING", () => {
    expect(() => assertProviderJobTransition("COMPLETED", "RUNNING")).toThrow();
  });

  it("terminal statuses", () => {
    expect(isTerminalProviderJobStatus("COMPLETED")).toBe(true);
    expect(isTerminalProviderJobStatus("RUNNING")).toBe(false);
  });
});
