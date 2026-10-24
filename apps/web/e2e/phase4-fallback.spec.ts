import { test } from "@playwright/test";

/**
 * Phase 4C scenario 1: execute `phase3-mock-production.spec.ts` while staging has
 * PHASE4_AGENT_RUNTIME_ENABLED=false. This file documents the gate only.
 */
test.describe("Phase 4C fallback (run phase3-mock-production.spec.ts)", () => {
  test.skip(true, "Use phase3-mock-production.spec.ts for Scenario 1 regression");
});
