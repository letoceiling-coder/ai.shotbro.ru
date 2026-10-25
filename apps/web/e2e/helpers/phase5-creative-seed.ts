import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function seedScriptScene(page: Page, projectId: string, title = "E2E scene") {
  const sceneRes = await page.request.post(`/api/v1/projects/${projectId}/scripts/scenes`, {
    data: { title },
  });
  expect(sceneRes.ok()).toBeTruthy();
  const scriptRes = await page.request.get(`/api/v1/projects/${projectId}/script`);
  expect(scriptRes.ok()).toBeTruthy();
  const script = (await scriptRes.json()) as { payload?: { scenes?: Array<{ id: string }> } };
  const sceneId = script.payload?.scenes?.[0]?.id;
  expect(sceneId).toBeTruthy();
  await page.request.post(`/api/v1/projects/${projectId}/storyboard/sync`, { data: {} });
  return sceneId!;
}

/** 1×1 PNG */
export function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
}

export async function uploadTinyImage(page: Page, projectId: string) {
  const init = await page.request.post("/api/v1/uploads/init", {
    data: {
      projectId,
      filename: "e2e-ref.png",
      mimeType: "image/png",
      sizeBytes: tinyPngBuffer().length,
    },
  });
  expect(init.ok()).toBeTruthy();
  const body = (await init.json()) as { sessionId: string; assetId: string; uploadUrl: string; mode: string };
  if (body.mode === "single") {
    const put = await page.request.put(body.uploadUrl, {
      headers: { "Content-Type": "image/png" },
      data: tinyPngBuffer(),
    });
    expect(put.ok()).toBeTruthy();
    const complete = await page.request.post(`/api/v1/uploads/${body.sessionId}/complete`, { data: {} });
    expect(complete.ok()).toBeTruthy();
  }
  return body.assetId;
}
