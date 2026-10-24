import { describe, expect, it } from "vitest";
import { ScriptDocumentSchema, ScriptScenePayloadSchema } from "@shotbro/contracts/production";

describe("ScriptDocumentSchema", () => {
  it("parses legacy scenes with defaults for revision and status", () => {
    const doc = ScriptDocumentSchema.parse({
      title: "Test",
      totalDurationSeconds: 6,
      scenes: [
        {
          id: "a",
          sequence: 1,
          title: "One",
          durationSeconds: 3,
          description: "d",
        },
        {
          id: "b",
          sequence: 2,
          title: "Two",
          durationSeconds: 3,
          description: "d2",
        },
      ],
    });
    expect(doc.scenes[0]?.revision).toBe(1);
    expect(doc.scenes[0]?.status).toBe("draft");
    expect(doc.scenes[0]?.characters).toEqual([]);
  });

  it("accepts extended scene fields", () => {
    const scene = ScriptScenePayloadSchema.parse({
      id: "x",
      sequence: 1,
      title: "Hero",
      durationSeconds: 5,
      description: "desc",
      dialogue: "Hello",
      camera: "dolly in",
      revision: 2,
      status: "review",
    });
    expect(scene.dialogue).toBe("Hello");
    expect(scene.revision).toBe(2);
  });
});
