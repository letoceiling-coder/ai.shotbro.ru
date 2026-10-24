import { describe, expect, it } from "vitest";
import { invalidateSceneDependents, planProductionGraph, sceneGraphVersionHash } from "./graph-planner.js";

describe("production graph planner", () => {
  it("plans acyclic graph with scene branches", () => {
    const nodes = planProductionGraph({
      runId: "run-1",
      sceneIds: ["s1", "s2"],
      scriptVersion: 1,
      storyboardVersion: 1,
    });
    expect(nodes.some((n) => n.nodeType === "ASSEMBLY")).toBe(true);
    expect(nodes.filter((n) => n.nodeType === "VIDEO_GENERATION")).toHaveLength(2);
  });

  it("invalidates only scene 3 dependents", () => {
    const nodes = planProductionGraph({
      runId: "run-1",
      sceneIds: ["s1", "s2", "s3"],
      scriptVersion: 1,
      storyboardVersion: 1,
    });
    const stale = invalidateSceneDependents(nodes, "s3", "run-1");
    expect(stale.some((id) => id.includes("s1"))).toBe(false);
    expect(stale.some((id) => id.includes("s3"))).toBe(true);
    expect(stale.some((id) => id.includes("assembly"))).toBe(true);
  });

  it("changes scene hash when prompt or character version changes", () => {
    const base = "abc123";
    const h1 = sceneGraphVersionHash(base, "s1", { promptVersion: 1, characterVersion: 1 });
    const h2 = sceneGraphVersionHash(base, "s1", { promptVersion: 2, characterVersion: 1 });
    const h3 = sceneGraphVersionHash(base, "s1", { promptVersion: 2, characterVersion: 2 });
    expect(h2).not.toBe(h1);
    expect(h3).not.toBe(h2);
  });
});
