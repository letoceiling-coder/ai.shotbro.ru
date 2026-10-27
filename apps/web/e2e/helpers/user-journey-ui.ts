import { expect, type Page } from "@playwright/test";
import { uploadImageViaPicker } from "./phase5-creative-ui";

export async function attachReferenceViaUi(page: Page, role: "STYLE" | "FIRST_FRAME") {
  await page.getByTestId("reference-role").click();
  await page.getByRole("option", { name: role }).click();
  await page.getByTestId("reference-attach-open").click();
  await uploadImageViaPicker(page);
  await expect(page.getByTestId("reference-list")).toContainText(role, { timeout: 30_000 });
}

export async function syncTimelineFromStoryboardViaUi(page: Page, projectId: string) {
  await page.getByTestId("storyboard-sync").click();
  await expect
    .poll(async () => (await page.request.get(`/api/v1/projects/${projectId}/storyboard`)).ok(), {
      timeout: 60_000,
    })
    .toBe(true);

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/timeline/sync-from-storyboard") && r.ok(), { timeout: 90_000 }),
    page.getByTestId("timeline-sync-storyboard").click(),
  ]);

  await expect
    .poll(async () => {
      const r = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
      if (!r.ok()) return 0;
      const j = (await r.json()) as { payload?: { tracks?: Array<{ type: string; clips?: unknown[] }> } };
      const video = j.payload?.tracks?.find((t) => t.type === "VIDEO");
      return video?.clips?.length ?? 0;
    }, { timeout: 60_000 })
    .toBeGreaterThan(0);
}

export async function reorderTimelineClipViaUi(page: Page, projectId: string) {
  const r = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
  expect(r.ok()).toBeTruthy();
  const j = (await r.json()) as {
    payload?: { tracks?: Array<{ clips?: Array<{ clipId: string; order: number }> }> };
  };
  const clips = j.payload?.tracks?.find((t) => t.clips?.length)?.clips ?? [];
  if (clips.length < 2) return;
  const first = clips.find((c) => c.order === 0)!;
  await page.getByTestId(`timeline-clip-down-${first.clipId}`).click();
  await expect
    .poll(async () => {
      const t = await page.request.get(`/api/v1/projects/${projectId}/timeline`);
      const body = (await t.json()) as { payload?: { revision?: number } };
      return body.payload?.revision ?? 0;
    }, { timeout: 30_000 })
    .toBeGreaterThan(1);
}
