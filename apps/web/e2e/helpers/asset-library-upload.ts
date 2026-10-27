import { expect, type Page } from "@playwright/test";

export type UploadFilePayload = { name: string; mimeType: string; buffer: Buffer };

function uploadInitResponse(page: Page) {
  return page.waitForResponse(
    (r) => r.url().includes("/api/v1/uploads/init") && r.request().method() === "POST" && r.ok(),
    { timeout: 60_000 },
  );
}

function uploadCompleteResponse(page: Page) {
  return page.waitForResponse(
    (r) => r.url().includes("/api/v1/uploads/") && r.url().includes("/complete") && r.ok(),
    { timeout: 120_000 },
  );
}

export async function waitForUploadPipeline(page: Page) {
  await uploadInitResponse(page);
  await uploadCompleteResponse(page);
}

/** REAL UI: «Загрузить» → Playwright filechooser → native input (no DnD). */
export async function uploadViaLibraryFilePicker(page: Page, file: UploadFilePayload) {
  await expect(page.getByTestId("asset-upload")).toBeEnabled();
  const initPromise = uploadInitResponse(page);
  const completePromise = uploadCompleteResponse(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 30_000 }),
    page.getByTestId("asset-upload").click(),
  ]);
  await chooser.setFiles(file);
  await initPromise;
  await completePromise;
}

/** @deprecated alias */
export const uploadViaLibraryButton = uploadViaLibraryFilePicker;

/** REAL UI: drag-and-drop onto library root (same handler as browser drop). */
export async function uploadViaLibraryDrop(page: Page, file: UploadFilePayload) {
  const b64 = file.buffer.toString("base64");
  const initPromise = uploadInitResponse(page);
  const completePromise = uploadCompleteResponse(page);
  await page.getByTestId("asset-library").evaluate(
    (el, payload) => {
      const bin = Uint8Array.from(atob(payload.b64), (c) => c.charCodeAt(0));
      const f = new File([bin], payload.name, { type: payload.mimeType });
      const dt = new DataTransfer();
      dt.items.add(f);
      el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { name: file.name, mimeType: file.mimeType, b64 },
  );
  await initPromise;
  await completePromise;
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
