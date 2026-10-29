import { expect, type Page } from "@playwright/test";
import { gotoStudioSection } from "./phase5-creative-ui";
import { ensureRealCreateVisible } from "./real-login";
import { pinRealProjectOnReload } from "./real-studio-state";

type MessageRow = {
  id: string;
  role?: string;
  blocks?: Array<{ type?: string; title?: string; markdown?: string }>;
};

async function defaultConversationId(page: Page, projectId: string): Promise<string | undefined> {
  const res = await page.request.get(`/api/v1/projects/${projectId}/conversations`);
  if (!res.ok()) return undefined;
  const body = (await res.json()) as { items?: Array<{ id: string }> } | Array<{ id: string }>;
  const list = Array.isArray(body) ? body : (body.items ?? []);
  return list[0]?.id;
}

export async function fetchConversationMessages(page: Page, conversationId: string): Promise<MessageRow[]> {
  const res = await page.request.get(`/api/v1/conversations/${conversationId}/messages`);
  if (!res.ok()) return [];
  const body = (await res.json()) as { items?: MessageRow[] } | MessageRow[];
  return Array.isArray(body) ? body : (body.items ?? []);
}

/** PostgreSQL/API truth: assistant message contains a block type (e.g. generation_plan, approval). */
export async function waitForAssistantBlockInApi(
  page: Page,
  projectId: string,
  predicate: (blocks: NonNullable<MessageRow["blocks"]>) => boolean,
  timeoutMs = 180_000,
) {
  await expect
    .poll(
      async () => {
        const cid = await defaultConversationId(page, projectId);
        if (!cid) return false;
        const msgs = await fetchConversationMessages(page, cid);
        for (const m of msgs) {
          if (m.role !== "assistant" && m.role !== "ASSISTANT") continue;
          const blocks = m.blocks ?? [];
          if (predicate(blocks)) return true;
        }
        return false;
      },
      { timeout: timeoutMs, intervals: [500, 1000, 2000, 3000] },
    )
    .toBe(true);
}

export async function scrollRealThreadToBottom(page: Page) {
  const thread = page.getByTestId("real-thread");
  if (await thread.isVisible().catch(() => false)) {
    await thread.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }
}

/** After API gate passes, reload once so React Query refetches even if SSE was missed. */
async function ensureRealProjectRowVisible(page: Page, projectId: string) {
  const row = page.getByTestId(`real-project-${projectId}`);
  if (await row.isVisible().catch(() => false)) return;
  await ensureRealCreateVisible(page);
  const projects = page.getByRole("button", { name: "Проекты" });
  if (await projects.isVisible().catch(() => false)) await projects.click();
  await expect(row).toBeVisible({ timeout: 30_000 });
}

export async function resyncRealThreadFromApi(page: Page, projectId: string) {
  await pinRealProjectOnReload(page, projectId, "chat", { creativeAutoNavigate: false });
  await gotoStudioSection(page, projectId, "chat");
  await ensureRealProjectRowVisible(page, projectId);
  await page.getByTestId(`real-project-${projectId}`).click();
  await page.getByTestId("creative-section-chat").click();
  await expect(page.getByTestId("real-thread")).toBeVisible({ timeout: 90_000 });
  await scrollRealThreadToBottom(page);
}
