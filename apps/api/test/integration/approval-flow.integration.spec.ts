import { describe, expect, it, beforeAll } from "vitest";
import { apiJson, expectOk2xx, requireIntegrationEnv, signInIntegrationUser, type AuthSession } from "./http-helpers";

describe("Approval flow (integration)", () => {
  let session: AuthSession;
  let projectId: string;
  let conversationId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    session = await signInIntegrationUser("A");
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: `Approval test ${ts}` }),
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

  it("reject and request-revision update status", async () => {
    const rej = await apiJson<{ approvalId: string; payloadHash: string; targetVersion: string }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title: "Reject me",
          targetType: "artifact",
          targetId: "artifact-r",
          targetVersion: "v1",
          payload: {},
        }),
      },
    );
    const rejected = await apiJson<{ status: string }>(
      `/api/v1/approvals/${rej.json.approvalId}/reject`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: rej.json.targetVersion,
          payloadHash: rej.json.payloadHash,
          idempotencyKey: `reject-${rej.json.approvalId}`,
        }),
      },
    );
    expect(rejected.json.status).toBe("REJECTED");

    const rev = await apiJson<{ approvalId: string; payloadHash: string; targetVersion: string }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title: "Revision me",
          targetType: "artifact",
          targetId: "artifact-rev",
          targetVersion: "v1",
          payload: {},
        }),
      },
    );
    const revision = await apiJson<{ status: string }>(
      `/api/v1/approvals/${rev.json.approvalId}/request-revision`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: rev.json.targetVersion,
          payloadHash: rev.json.payloadHash,
          idempotencyKey: `rev-${rev.json.approvalId}`,
        }),
      },
    );
    expect(revision.json.status).toBe("REQUIRES_REVISION");
  });

  it("idempotent approve returns same result", async () => {
    const created = await apiJson<{ approvalId: string; payloadHash: string; targetVersion: string }>(
      `/api/v1/projects/${projectId}/approvals`,
      session,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title: "Idempotent",
          targetType: "artifact",
          targetId: "artifact-idem",
          targetVersion: "v1",
          payload: {},
        }),
      },
    );
    const key = `idem-${created.json.approvalId}`;
    const body = {
      expectedVersion: created.json.targetVersion,
      payloadHash: created.json.payloadHash,
      idempotencyKey: key,
    };
    const a1 = await apiJson<{ status: string }>(
      `/api/v1/approvals/${created.json.approvalId}/approve`,
      session,
      { method: "POST", body: JSON.stringify(body) },
    );
    const a2 = await apiJson<{ status: string }>(
      `/api/v1/approvals/${created.json.approvalId}/approve`,
      session,
      { method: "POST", body: JSON.stringify(body) },
    );
    expect(a1.json.status).toBe("APPROVED");
    expect(a2.json.status).toBe("APPROVED");
  });
});
