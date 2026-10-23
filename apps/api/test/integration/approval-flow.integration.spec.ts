import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, expectOk2xx, requireIntegrationEnv, signUp, type AuthSession } from "./http-helpers";

describe("Approval flow (integration)", () => {
  let session: AuthSession;
  let projectId: string;
  let conversationId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const ts = Date.now();
    session = await signUp(`approval-${ts}@test.local`, "TestPass123!", "Approver");
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: "Approval test" }),
    });
    projectId = created.json.id;
    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${projectId}/conversations`, session);
    expectOk2xx(convs.status);
    conversationId = convs.json[0]!.id;
  });

  it("create → approve → list shows APPROVED", async () => {
    const created = await apiJson<{
      approvalId: string;
      payloadHash: string;
      targetVersion: string;
    }>(`/api/v1/projects/${projectId}/approvals`, session, {
      method: "POST",
      body: JSON.stringify({
        conversationId,
        title: "Согласовать макет",
        targetType: "artifact",
        targetId: "artifact-1",
        targetVersion: "v1",
        payload: { step: "frame" },
      }),
    });
    expectOk2xx(created.status);
    const { approvalId, payloadHash, targetVersion } = created.json;

    const approved = await apiJson<{ status: string }>(`/api/v1/approvals/${approvalId}/approve`, session, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: targetVersion,
        payloadHash,
        idempotencyKey: `approve-${approvalId}`,
      }),
    });
    expectOk2xx(approved.status);
    expect(approved.json.status).toBe("APPROVED");

    const list = await apiJson<{ items: Array<{ id: string; status: string }> }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
    );
    expect(list.json.items.find((a) => a.id === approvalId)?.status).toBe("APPROVED");
  });

  it("version conflict returns 409", async () => {
    const created = await apiJson<{ approvalId: string; payloadHash: string }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title: "Conflict test",
          targetType: "artifact",
          targetId: "artifact-2",
          targetVersion: "v2",
          payload: {},
        }),
      },
    );
    const res = await apiJson(`/api/v1/approvals/${created.json.approvalId}/approve`, session, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: "wrong-version",
        payloadHash: created.json.payloadHash,
      }),
    });
    expect(res.status).toBe(409);
  });
});
