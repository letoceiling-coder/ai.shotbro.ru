import type { TalentDelegates } from "@shotbro/ai";
import { quoteTalentOperation } from "@shotbro/ai";
import type { AppEnv } from "@shotbro/config/env";
import { evaluateLiveMediaPolicy } from "@shotbro/config/live-media-policy";
import type { TalentOperation } from "@shotbro/contracts";
import type { TalentJobsService } from "./talent-jobs.service";
import type { TalentService } from "./talent.service";

const OPERATIONS: TalentOperation[] = ["VOICE_DESIGN", "VOICE_SAVE", "VOICE_CLONE", "AVATAR_TRAIN"];

/** Agent-facing adapters over TalentService / TalentJobsService (same checks as the REST API). */
export function buildTalentAgentDelegates(deps: { talent: TalentService; jobs: TalentJobsService; env: AppEnv }): TalentDelegates {
  return {
    capabilities: async () => {
      const live = evaluateLiveMediaPolicy(deps.env, "talent");
      return {
        mockMode: deps.env.AI_MOCK_MODE,
        liveTalent: { allowed: live.liveMediaAllowed, reasons: live.reasons },
        providerChains: {
          AVATAR_TRAIN: deps.talent.providerChain("AVATAR_TRAIN"),
          AVATAR_VIDEO: deps.talent.providerChain("AVATAR_VIDEO"),
          SCENE_VIDEO: deps.talent.providerChain("SCENE_VIDEO"),
        },
        prices: OPERATIONS.map((op) => quoteTalentOperation(deps.env, op)),
        budgetCaps: { perRunUsd: deps.env.MEDIA_RUN_MAX_COST_USD, perUserDailyUsd: deps.env.MEDIA_USER_DAILY_MAX_USD },
        rules: [
          "Платные действия — только через propose_talent_operation и подтверждение пользователя.",
          "Голос из библиотеки и аватар без HeyGen (REFERENCE) — бесплатно.",
          "Клон голоса и фото-аватар требуют согласия владельца голоса/лица.",
        ],
      };
    },

    listVoices: async ({ userId, language, gender }) => {
      const mine = await deps.talent.listVoices(userId);
      const library = await deps.talent.libraryVoices();
      const match = (l: { language?: string; gender?: string }) =>
        (!language || l.language === language) && (!gender || l.gender === gender);
      return {
        workspace: mine.items.map((v) => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, labels: v.labels })),
        library: library.items.filter((v) => match(v.labels)).slice(0, 20),
        libraryMock: library.mock,
      };
    },

    listAvatars: async ({ userId }) => {
      const res = await deps.talent.listAvatars(userId);
      return {
        items: res.items.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          status: a.status,
          defaultVoiceProfileId: a.defaultVoiceProfileId,
          looks: a.looks.map((l) => ({ id: l.id, label: l.label, isDefault: l.isDefault })),
        })),
      };
    },

    createVoice: async ({ userId, body }) => ({ voice: await deps.talent.createVoice(userId, body) }),
    createAvatar: async ({ userId, body }) => ({ avatar: await deps.talent.createAvatar(userId, body) }),
    assignToCharacter: async ({ userId, projectId, characterId, body }) => ({
      character: await deps.talent.assignToCharacter(userId, projectId, characterId, body),
    }),
    propose: async ({ userId, projectId, conversationId, body }) => ({
      quote: await deps.jobs.quote(userId, { ...body, projectId, conversationId }),
      awaitingUserApproval: true,
    }),
  };
}
