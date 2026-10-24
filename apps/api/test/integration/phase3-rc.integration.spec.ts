import { describe, expect, it } from "vitest";
import { assertExternalProviderExecutionAllowed } from "@shotbro/config";
import { loadEnvFromProcess } from "@shotbro/config/env";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signIn,
  signInIntegrationUser,
  type AuthSession,
} from "./http-helpers";

const STAGING = Boolean(process.env.INTEGRATION_API_URL?.includes("ai.shotbro.ru"));

describe("Phase 3 RC guards (local)", () => {
  it("EXTERNAL_PAID hard block when live execution disabled", () => {
    const env = loadEnvFromProcess({
      S3_ENDPOINT: "http://127.0.0.1:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "test",
      S3_ACCESS_KEY_ID: "12345678901234567890",
      S3_SECRET_ACCESS_KEY: "12345678901234567890",
      OPENROUTER_ENABLED: "false",
      OPENROUTER_ALLOW_PAID_REQUESTS: "false",
      AI_MOCK_MODE: "true",
      PROVIDER_LIVE_EXECUTION_ENABLED: "false",
      EMAIL_ENABLED: "false",
    });
    expect(() => assertExternalProviderExecutionAllowed(env, "EXTERNAL_PAID")).toThrow(/blocked/i);
  });
});

describe.skipIf(!STAGING)("Phase 3 RC staging checks", () => {
  let session: AuthSession;

  it("budget reserve idempotency", async () => {
    requireIntegrationEnv();
    session = await signIn(integrationCredentials("A").email, integrationCredentials("A").password);
    const { json: projects } = await apiJson<{ items: { id: string }[] }>("/api/v1/projects", session);
    const projectId = projects.items[0]!.id;
    const key = `rc-idem-${Date.now()}`;
    const body = { amountUsd: 0.5, idempotencyKey: key, reason: "rc_test" };
    const a = await apiJson<{ id: string }>(`/api/v1/projects/${projectId}/cost/reserve`, session, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const b = await apiJson<{ id: string }>(`/api/v1/projects/${projectId}/cost/reserve`, session, {
      method: "POST",
      body: JSON.stringify(body),
    });
    expectOk2xx(a.status);
    expect(a.json.id).toBe(b.json.id);
  });

  it("cross-tenant approval decide denied", async () => {
    const a = await signInIntegrationUser("A");
    const b = await signInIntegrationUser("B");
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", a, {
      method: "POST",
      body: JSON.stringify({ title: `RC iso ${ts}` }),
    });
    const convs = await apiJson<Array<{ id: string }>>(`/api/v1/projects/${created.json.id}/conversations`, a);
    const approval = await apiJson<{ approvalId: string; payloadHash: string; targetVersion: string }>(
      `/api/v1/projects/${created.json.id}/approvals`,
      a,
      {
        method: "POST",
        body: JSON.stringify({
          conversationId: convs.json[0]!.id,
          title: "RC iso",
          targetType: "artifact",
          targetId: "x",
          targetVersion: "1",
          payload: {},
        }),
      },
    );
    const denied = await apiJson(`/api/v1/approvals/${approval.json.approvalId}/approve`, b, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: approval.json.targetVersion,
        payloadHash: approval.json.payloadHash,
      }),
    });
    expect(denied.status).toBeGreaterThanOrEqual(403);
  });
});
