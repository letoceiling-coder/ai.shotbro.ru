import { describe, expect, it } from "vitest";
import { ProductionAssetIngestionService } from "./production-asset-ingestion.js";

describe("ProductionAssetIngestionService", () => {
  const svc = new ProductionAssetIngestionService({
    maxBytes: 1024 * 1024,
    allowedMimePrefixes: ["image/", "video/", "audio/"],
    allowedHostnames: ["fixtures.shotbro.test"],
  });

  it("blocks private IP hosts", () => {
    expect(svc.validateUrl("http://127.0.0.1/file.png").ok).toBe(false);
  });

  it("ingests fixture when host allowlisted", async () => {
    const res = await svc.ingestFromFixture(
      { projectId: "p1", sourceUrl: "https://fixtures.shotbro.test/a.png", ownerId: "u1" },
      { bytes: Buffer.from("mock"), mimeType: "image/png" },
    );
    expect(res.ok).toBe(true);
    expect(res.mock).toBe(true);
  });
});
