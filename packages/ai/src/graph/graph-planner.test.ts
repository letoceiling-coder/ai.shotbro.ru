import { describe, expect, it } from "vitest";
import { invalidateSceneDependents, planProductionGraph } from "./graph-planner.js";

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
});
