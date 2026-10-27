import { expect, type Page } from "@playwright/test";

export type UploadFilePayload = { name: string; mimeType: string; buffer: Buffer };

export async function waitForUploadPipeline(page: Page) {
  await page.waitForResponse(
    (r) => r.url().includes("/api/v1/uploads/init") && r.request().method() === "POST" && r.ok(),
    { timeout: 60_000 },
  );
  await page.waitForResponse(
    (r) => r.url().includes("/api/v1/uploads/") && r.url().includes("/complete") && r.ok(),
    { timeout: 120_000 },
  );
}

/** REAL UI: Assets → «Загрузить» → native file chooser (Playwright filechooser API). */
export async function uploadViaLibraryButton(page: Page, file: UploadFilePayload) {
  const chooserPromise = page.waitForEvent("filechooser", { timeout: 30_000 });
  await page.getByTestId("asset-upload").click();
  const chooser = await chooserPromise;
  await Promise.all([waitForUploadPipeline(page), chooser.setFiles(file)]);
}

/** REAL UI: drag-and-drop onto library root (same handler as browser drop). */
export async function uploadViaLibraryDrop(page: Page, file: UploadFilePayload) {
  const b64 = file.buffer.toString("base64");
  await Promise.all([
    waitForUploadPipeline(page),
    page.getByTestId("asset-library").evaluate(
      (el, payload) => {
        const bin = Uint8Array.from(atob(payload.b64), (c) => c.charCodeAt(0));
        const f = new File([bin], payload.name, { type: payload.mimeType });
        const dt = new DataTransfer();
        dt.items.add(f);
        el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      },
      { name: file.name, mimeType: file.mimeType, b64 },
    ),
  ]);
}

type AssetListItem = { id: string; status: string; originalName: string };

export async function pollAssetReady(
  page: Page,
  projectId: string,
  originalName: string,
  query: string,
  timeoutMs: number,
): Promise<string> {
  let lastId = "";
  await expect
    .poll(
      async () => {
        const r = await page.request.get(`/api/v1/projects/${projectId}/assets?limit=24&q=${encodeURIComponent(query)}`);
        if (!r.ok()) return false;
        const j = (await r.json()) as { items?: AssetListItem[] };
        const item = (j.items ?? []).find((a) => a.originalName === originalName);
        if (!item) return false;
        lastId = item.id;
        if (item.status === "FAILED") {
          throw new Error(`Asset ${originalName} FAILED (id=${item.id})`);
        }
        return item.status === "READY";
      },
      { timeout: timeoutMs, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  return lastId;
}
