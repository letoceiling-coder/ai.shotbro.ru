import { describe, expect, it } from "vitest";
import { integrationCredentials, signIn, apiJson, expectOk2xx } from "./http-helpers";

const enabled = Boolean(process.env.INTEGRATION_API_URL && process.env.E2E_TEST_EMAIL);

describe.skipIf(!enabled)("Phase 3 agent production (integration)", () => {
  it("cost reserve idempotency for same key", async () => {
    const session = await signIn(integrationCredentials("A").email, integrationCredentials("A").password);
    const { status, json: projects } = await apiJson<{ items: { id: string }[] }>("/api/v1/projects", session);
    expectOk2xx(status);
    const projectId = projects.items[0]?.id;
    expect(projectId).toBeTruthy();

    const body = {
      amountUsd: 1.5,
      idempotencyKey: `test-idem-${Date.now()}`,
      reason: "integration_test",
    };
    const a = await apiJson<{ id: string }>(`/api/v1/projects/${projectId}/cost/reserve`, session, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const b = await apiJson<{ id: string }>(`/api/v1/projects/${projectId}/cost/reserve`, session, {
      method: "POST",
      body: JSON.stringify(body),
    });
    expectOk2xx(a.status);
    expectOk2xx(b.status);
    expect(a.json.id).toBe(b.json.id);
  });
});
