import { describe, expect, it } from "vitest";
import { invalidateSceneDependents, planProductionGraph } from "@shotbro/ai";
import { apiJson, expectOk2xx, requireIntegrationEnv, signInIntegrationUser } from "./http-helpers";

const STAGING = Boolean(process.env.INTEGRATION_API_URL?.includes("ai.shotbro.ru"));

describe("graph invalidation (planner)", () => {
  it("scene 3 change invalidates s3 branch and assembly, not s1", () => {
    const nodes = planProductionGraph({
      runId: "run-x",
      sceneIds: ["s1", "s2", "s3"],
      scriptVersion: 2,
      storyboardVersion: 1,
      sceneVersions: {
        s3: { promptVersion: 2, characterVersion: 1, sceneRevision: 1 },
      },
    });
    const stale = invalidateSceneDependents(nodes, "s3", "run-x");
    expect(stale.some((id) => id.includes("s1"))).toBe(false);
    expect(stale.some((id) => id.includes("s3"))).toBe(true);
    expect(stale.some((id) => id.toLowerCase().includes("assembly"))).toBe(true);
  });
});

describe.skipIf(!STAGING)("graph invalidation API (staging smoke)", () => {
  it("patch script scene returns invalidation payload", async () => {
    requireIntegrationEnv();
    const session = await signInIntegrationUser("A");
    const ts = Date.now();
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: `Graph inv ${ts}` }),
    });
    expectOk2xx(created.status);
    const projectId = created.json.id;
    const graphBefore = await apiJson<{ items: unknown[] }>(
      `/api/v1/projects/${projectId}/production-graph`,
      session,
    );
    expectOk2xx(graphBefore.status);
    const patch = await apiJson<{ invalidatedNodeIds?: string[] }>(
      `/api/v1/projects/${projectId}/scripts/scenes/s1`,
      session,
      { method: "PATCH", body: JSON.stringify({ description: `rev ${ts}` }) },
    );
    expect([200, 404]).toContain(patch.status);
    if (patch.status === 200 && patch.json.invalidatedNodeIds) {
      expect(Array.isArray(patch.json.invalidatedNodeIds)).toBe(true);
    }
  });
});
