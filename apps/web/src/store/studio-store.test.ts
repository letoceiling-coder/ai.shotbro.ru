import { describe, expect, it } from "vitest";
import { createInitialDemoProjects } from "@shotbro/contracts";

describe("demo projects", () => {
  it("seeds four demo scenarios", () => {
    const projects = createInitialDemoProjects();
    expect(projects).toHaveLength(4);
    expect(projects.map((p) => p.demoScenarioId).sort()).toEqual(
      ["ad", "avatar", "cartoon", "photo"].sort(),
    );
  });
});
