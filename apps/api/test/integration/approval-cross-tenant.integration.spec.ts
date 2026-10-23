import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, expectOk2xx, requireIntegrationEnv, signInIntegrationUser, type AuthSession } from "./http-helpers";

describe("Approval cross-tenant (integration)", () => {
  let owner: AuthSession;
  let intruder: AuthSession;
  let projectId: string;
  let conversationId: string;
  let approvalId: string;
  let payloadHash: string;
  let targetVersion: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    owner = await signInIntegrationUser("A");
    intruder = await signInIntegrationUser("B");
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", owner, {
      method: "POST",
      body: JSON.stringify({ title: `Approval iso ${ts}` }),
    });
    projectId = created.json.id;
    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${projectId}/conversations`, owner);
    conversationId = convs.json[0]!.id;
    const ap = await apiJson<{ approvalId: string; payloadHash: string; targetVersion: string }>(
      `/api/v1/projects/${projectId}/approvals`,
      owner,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title: "Private approval",
          targetType: "artifact",
          targetId: "x",
          targetVersion: "v1",
          payload: {},
        }),
      },
    );
    expectOk2xx(ap.status);
    approvalId = ap.json.approvalId;
    payloadHash = ap.json.payloadHash;
    targetVersion = ap.json.targetVersion;
  });

  it("intruder cannot approve foreign approval", async () => {
    const res = await apiJson(`/api/v1/approvals/${approvalId}/approve`, intruder, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: targetVersion,
        payloadHash,
        idempotencyKey: `cross-${approvalId}`,
      }),
    });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});
