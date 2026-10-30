import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "@shotbro/config/env";
import { evaluateBudgetCaps, quoteTalentOperation, talentApprovalPayload } from "../cost/talent-price-catalog.js";
import { ToolExecutor, type TalentDelegates, type ToolRunContext } from "../tool-executor.js";
import { getPhase4Tool } from "./phase4-tool-catalog.js";
import { CREATIVE_LLM_TOOL_IDS, buildCreativeOpenAiTools } from "./creative-llm-tools.js";
import { registerPhase6TalentTools } from "./tool-handlers/phase6-talent-tools.js";

const mockEnv = { AI_MOCK_MODE: true, PROVIDER_LIVE_EXECUTION_ENABLED: false, MEDIA_GENERATION_ENABLED: false } as unknown as AppEnv;
const liveEnv = { ...mockEnv, AI_MOCK_MODE: false } as AppEnv;

const TALENT_TOOLS = [
  "get_studio_capabilities",
  "list_voices",
  "list_avatars",
  "create_voice_profile",
  "create_avatar_profile",
  "assign_talent_to_character",
  "propose_talent_operation",
];

function memoryStorage() {
  const execs = new Map<string, Record<string, unknown>>();
  return {
    findToolExecution: async (_run: string, key: string) => execs.get(key) ?? null,
    saveToolExecution: async (row: Record<string, unknown>) => void execs.set(String(row.idempotencyKey), row),
    emitEvent: async () => undefined,
  };
}

function fakeTalent(): TalentDelegates & { calls: string[] } {
  const calls: string[] = [];
  const rec = (name: string, out: Record<string, unknown>) => async () => {
    calls.push(name);
    return out;
  };
  return {
    calls,
    capabilities: rec("capabilities", { mockMode: true }),
    listVoices: rec("listVoices", { workspace: [], library: [] }),
    listAvatars: rec("listAvatars", { items: [] }),
    createVoice: rec("createVoice", { voice: { id: "v1" } }),
    createAvatar: rec("createAvatar", { avatar: { id: "a1" } }),
    assignToCharacter: rec("assignToCharacter", { character: { id: "c1" } }),
    propose: vi.fn(async () => {
      calls.push("propose");
      return { quote: { approvalId: "ap1", estimatedLiveUsd: 0.06, mock: true }, awaitingUserApproval: true };
    }),
  };
}

function ctx(talent: TalentDelegates): ToolRunContext {
  return {
    env: mockEnv,
    storage: memoryStorage(),
    runId: "run1",
    projectId: "p1",
    userId: "u1",
    conversationId: "conv1",
    delegates: { talent },
  } as unknown as ToolRunContext;
}

describe("Phase 6C agent protocol: propose → user approves → server runs", () => {
  it("talent tools are exposed to the LLM and none of them is a paid side effect", () => {
    const names = buildCreativeOpenAiTools().map((t) => t.function.name);
    for (const id of TALENT_TOOLS) {
      expect(names).toContain(id);
      expect(CREATIVE_LLM_TOOL_IDS).toContain(id);
      const def = getPhase4Tool(id);
      expect(def?.sideEffect).not.toBe("EXTERNAL_PAID");
      expect(def?.costClass).toBe("free");
    }
  });

  it("no LLM-visible tool can spend money directly", () => {
    for (const t of buildCreativeOpenAiTools()) {
      expect(getPhase4Tool(t.function.name)?.sideEffect, t.function.name).not.toBe("EXTERNAL_PAID");
    }
  });

  it("propose_talent_operation only creates a quote card and runs nothing else", async () => {
    const executor = new ToolExecutor(mockEnv);
    registerPhase6TalentTools(executor);
    const talent = fakeTalent();
    const out = await executor.execute(
      "propose_talent_operation",
      { operation: "VOICE_DESIGN", voiceProfileId: "v1" },
      ctx(talent),
      { idempotencyKey: "k1" },
    );
    expect(out).toMatchObject({ awaitingUserApproval: true });
    expect(talent.calls).toEqual(["propose"]);
    expect(talent.propose).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", conversationId: "conv1", body: { operation: "VOICE_DESIGN", voiceProfileId: "v1" } }),
    );
  });

  it("rejects malformed talent tool input before touching the server", async () => {
    const executor = new ToolExecutor(mockEnv);
    registerPhase6TalentTools(executor);
    const talent = fakeTalent();
    await expect(
      executor.execute("create_voice_profile", { kind: "DESIGNED", name: "x", designPrompt: "short" }, ctx(talent), { idempotencyKey: "k2" }),
    ).rejects.toThrow();
    expect(talent.calls).toEqual([]);
  });
});

describe("talent price catalog and caps", () => {
  it("mock mode shows the live estimate but charges $0", () => {
    const q = quoteTalentOperation(mockEnv, "VOICE_DESIGN");
    expect(q).toMatchObject({ chargedUsd: 0, mock: true, providerId: "mock-elevenlabs" });
    expect(q.estimatedLiveUsd).toBeGreaterThan(0);
    expect(q.note).toMatch(/Тестовый режим/);
  });

  it("live mode charges the estimate; clone is included in the ElevenLabs plan", () => {
    expect(quoteTalentOperation(liveEnv, "AVATAR_TRAIN").chargedUsd).toBe(1);
    expect(quoteTalentOperation(liveEnv, "VOICE_CLONE")).toMatchObject({ chargedUsd: 0, priceStatus: "INCLUDED_IN_PLAN" });
  });

  it("enforces run and daily caps (customer minimum: $1 / $3)", () => {
    expect(evaluateBudgetCaps({ chargedUsd: 1, spentTodayUsd: 0, runCapUsd: 1, dailyCapUsd: 3 })).toEqual({ ok: true });
    expect(evaluateBudgetCaps({ chargedUsd: 1.5, spentTodayUsd: 0, runCapUsd: 1, dailyCapUsd: 3 })).toMatchObject({ ok: false, code: "RUN_CAP_EXCEEDED" });
    expect(evaluateBudgetCaps({ chargedUsd: 1, spentTodayUsd: 2.5, runCapUsd: 1, dailyCapUsd: 3 })).toMatchObject({ ok: false, code: "DAILY_CAP_EXCEEDED" });
  });

  it("approval payload is canonical: same inputs → identical JSON, any change → different", () => {
    const a = talentApprovalPayload({ operation: "VOICE_SAVE", talentId: "v", talentVersion: "t1", generatedVoiceId: "g1", chargedUsd: 0 });
    const b = talentApprovalPayload({ chargedUsd: 0, generatedVoiceId: "g1", talentVersion: "t1", talentId: "v", operation: "VOICE_SAVE" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const other = talentApprovalPayload({ operation: "VOICE_SAVE", talentId: "v", talentVersion: "t1", generatedVoiceId: "g2", chargedUsd: 0 });
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(a));
  });
});
