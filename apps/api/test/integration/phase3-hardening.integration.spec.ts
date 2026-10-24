import { describe, expect, it } from "vitest";
import {
  apiJson,
  expectOk2xx,
  integrationCredentials,
  requireIntegrationEnv,
  signInIntegrationUser,
} from "./http-helpers";

const STAGING = Boolean(process.env.INTEGRATION_API_URL?.includes("ai.shotbro.ru"));

describe.skipIf(!STAGING)("Phase 3 hardening — integration users", () => {
  it("user A sign-in", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    expect(session.userId).toBeTruthy();
    const me = await apiJson<{ id: string }>("/api/v1/users/me", session);
    expectOk2xx(me.status);
    expect(me.json.id).toBe(session.userId);
  });

  it("user B sign-in", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("B");
    expect(session.userId).toBeTruthy();
    const creds = integrationCredentials("B");
    expect(session.email.toLowerCase()).toBe(creds.email.toLowerCase());
  });
});

describe.skipIf(!STAGING)("Phase 3 hardening — budget concurrency @ staging", () => {
  it("parallel reserve same idempotency key", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const { json: projects } = await apiJson<{ items: { id: string }[] }>("/api/v1/projects", session);
    const projectId = projects.items[0]!.id;
    const key = `hard-idem-${Date.now()}`;
    const body = JSON.stringify({ amountUsd: 0.25, idempotencyKey: key, reason: "hardening_parallel" });
    const path = `/api/v1/projects/${projectId}/cost/reserve`;
    const [a, b] = await Promise.all([
      apiJson<{ id: string }>(path, session, { method: "POST", body }),
      apiJson<{ id: string }>(path, session, { method: "POST", body }),
    ]);
    expectOk2xx(a.status);
    expectOk2xx(b.status);
    expect(a.json.id).toBe(b.json.id);
  });
});
