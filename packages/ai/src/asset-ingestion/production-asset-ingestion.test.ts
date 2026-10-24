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

  it("rejects disallowed redirect target", async () => {
    const res = await svc.ingestFromUrl(
      { projectId: "p1", sourceUrl: "https://fixtures.shotbro.test/a.png", ownerId: "u1" },
      async () => ({
        bytes: Buffer.from("mock"),
        mimeType: "image/png",
        finalUrl: "http://127.0.0.1/secret.png",
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("redirect_blocked");
  });

  it("rejects oversize fixture", async () => {
    const res = await svc.ingestFromFixture(
      { projectId: "p1", sourceUrl: "https://fixtures.shotbro.test/big.png", ownerId: "u1" },
      { bytes: Buffer.alloc(2 * 1024 * 1024), mimeType: "image/png" },
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("too_large");
  });

  it("rejects mime outside allowlist", async () => {
    const res = await svc.ingestFromFixture(
      { projectId: "p1", sourceUrl: "https://fixtures.shotbro.test/x.bin", ownerId: "u1" },
      { bytes: Buffer.from("x"), mimeType: "application/octet-stream" },
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("mime_not_allowed");
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
