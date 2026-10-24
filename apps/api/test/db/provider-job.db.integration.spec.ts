import { describe, expect, it, beforeAll } from "vitest";
import { v4 as uuid } from "uuid";
import { createDb } from "@shotbro/db/client";
import { project, user, workspace, workspaceMember } from "@shotbro/db/schema";
import { Phase4MockImageProvider, ProviderJobManager } from "@shotbro/ai";
import { DrizzleProviderJobStore } from "../../src/providers/drizzle-provider-job.store";

const dbUrl = process.env.INTEGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const enabled = Boolean(process.env.RUN_DB_INTEGRATION_TESTS === "1" && dbUrl);

describe.skipIf(!enabled)("ProviderJob (PostgreSQL)", () => {
  const { db } = createDb(dbUrl!);
  let projectId: string;

  beforeAll(async () => {
    const userId = uuid();
    const workspaceId = uuid();
    projectId = uuid();
    await db.insert(user).values({
      id: userId,
      name: "PJ Test",
      email: `pj-${userId}@shotbro.test`,
      emailVerified: true,
    });
    await db.insert(workspace).values({ id: workspaceId, name: "WS", ownerId: userId });
    await db.insert(workspaceMember).values({ workspaceId, userId, role: "OWNER" });
    await db.insert(project).values({
      id: projectId,
      workspaceId,
      ownerId: userId,
      title: "Provider Job Test",
      settings: {},
    });
  });

  it("persists idempotent provider job submit", async () => {
    const env = {
      AI_MOCK_MODE: true,
      PROVIDER_LIVE_EXECUTION_ENABLED: false,
      OPENROUTER_ALLOW_PAID_REQUESTS: false,
    } as import("@shotbro/config/env").AppEnv;
    const manager = new ProviderJobManager(env, new DrizzleProviderJobStore(db));
    const adapter = new Phase4MockImageProvider();
    const idempotencyKey = `idem-${uuid()}`;
    const payload = {
      id: uuid(),
      projectId,
      providerId: "mock-image",
      modelId: "mock/image",
      operation: "TEXT_TO_IMAGE",
      idempotencyKey,
      input: { prompt: "test" },
      userId: uuid(),
    };
    const a = await manager.submitWithAdapter(adapter, payload);
    const b = await manager.submitWithAdapter(adapter, { ...payload, id: uuid() });
    expect(a.id).toBe(b.id);
    expect(a.status).toBe("COMPLETED");
  });
});
