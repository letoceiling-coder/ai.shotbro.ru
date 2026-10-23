import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { apiJson, requireIntegrationEnv, signUp, type AuthSession } from "./http-helpers";

const png = readFileSync(resolve(process.cwd(), "test/fixtures/1x1.png"));

function resolveUploadUrl(url: string) {
  /** Presigned URLs are host-bound; only rewrite when explicitly testing against internal MinIO with matching signer config. */
  const base = process.env.INTEGRATION_S3_UPLOAD_BASE;
  if (!base || base.includes("minio")) return url;
  const u = new URL(url);
  return `${base.replace(/\/$/, "")}${u.pathname}${u.search}`;
}

describe("Upload flow (integration)", () => {
  let session: AuthSession;
  let projectId: string;

  beforeAll(async () => {
    requireIntegrationEnv();
    const ts = Date.now();
    session = await signUp(`upload-${ts}@test.local`, "TestPass123!", "Uploader");
    const created = await apiJson<{ id: string }>("/api/v1/projects", session, {
      method: "POST",
      body: JSON.stringify({ title: "Upload test" }),
    });
    projectId = created.json.id;
  });

  it("presigned init → PUT → complete → asset list", async () => {
    const init = await apiJson<{
      mode: string;
      sessionId: string;
      assetId: string;
      uploadUrl: string;
    }>("/api/v1/uploads/init", session, {
      method: "POST",
      body: JSON.stringify({
        projectId,
        filename: "1x1.png",
        mimeType: "image/png",
        sizeBytes: png.length,
      }),
    });
    expect(init.status).toBeGreaterThanOrEqual(200);
    expect(init.status).toBeLessThan(300);
    expect(init.json.mode).toBe("single");

    const put = await fetch(resolveUploadUrl(init.json.uploadUrl), {
      method: "PUT",
      headers: { "Content-Type": "image/png" },
      body: png,
    });
    if (!put.ok) {
      const errText = await put.text().catch(() => "");
      throw new Error(`S3 PUT ${put.status}: ${errText.slice(0, 200)}`);
    }

    const done = await apiJson<{ assetId: string; status: string }>(
      `/api/v1/uploads/${init.json.sessionId}/complete`,
      session,
      { method: "POST", body: JSON.stringify({}) },
    );
    expect(done.status).toBe(200);
    expect(done.json.status).toBe("PROCESSING");

    const assets = await apiJson<Array<{ id: string; status: string }>>(
      `/api/v1/projects/${projectId}/assets`,
      session,
    );
    expect(assets.status).toBe(200);
    expect(assets.json.some((a) => a.id === init.json.assetId)).toBe(true);
  });
});
