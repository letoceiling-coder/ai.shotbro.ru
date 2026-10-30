import type { AppEnv } from "@shotbro/config/env";
import type { TalentOperation } from "@shotbro/contracts";

/**
 * Phase 6C — user-facing price estimates for talent operations (USD).
 * Vendors bill by plan credits, so these are conservative estimates shown before approval.
 * Review against the actual ElevenLabs / HeyGen plans before Phase 6G live tests.
 */
export type TalentPriceStatus = "ESTIMATED" | "INCLUDED_IN_PLAN" | "FREE";

export type TalentQuote = {
  operation: TalentOperation;
  providerId: string;
  /** What the live provider is expected to cost. */
  estimatedLiveUsd: number;
  /** What this run will actually reserve/charge (0 in mock mode). */
  chargedUsd: number;
  priceStatus: TalentPriceStatus;
  /** Russian explanation for the approval card and the agent. */
  note: string;
  mock: boolean;
};

const CATALOG: Record<TalentOperation, { providerId: string; usd: number; status: TalentPriceStatus; note: string }> = {
  VOICE_DESIGN: {
    providerId: "elevenlabs",
    usd: 0.06,
    status: "ESTIMATED",
    note: "3 варианта голоса по описанию (кредиты ElevenLabs, оценка)",
  },
  VOICE_SAVE: {
    providerId: "elevenlabs",
    usd: 0,
    status: "INCLUDED_IN_PLAN",
    note: "Сохранение выбранного варианта в аккаунт ElevenLabs (входит в тариф)",
  },
  VOICE_CLONE: {
    providerId: "elevenlabs",
    usd: 0,
    status: "INCLUDED_IN_PLAN",
    note: "Клонирование голоса по записи (IVC входит в платный тариф ElevenLabs)",
  },
  AVATAR_TRAIN: {
    providerId: "heygen",
    usd: 1,
    status: "ESTIMATED",
    note: "Обучение фото-аватара HeyGen (оценка, уточнить по тарифу HeyGen)",
  },
};

export function quoteTalentOperation(env: AppEnv, operation: TalentOperation): TalentQuote {
  const row = CATALOG[operation];
  const mock = env.AI_MOCK_MODE;
  return {
    operation,
    providerId: mock ? `mock-${row.providerId}` : row.providerId,
    estimatedLiveUsd: row.usd,
    chargedUsd: mock ? 0 : row.usd,
    priceStatus: row.status,
    note: mock ? `${row.note}. Тестовый режим: списание $0` : row.note,
    mock,
  };
}

export type BudgetCapCheck = { ok: true } | { ok: false; code: "RUN_CAP_EXCEEDED" | "DAILY_CAP_EXCEEDED"; message: string };

/** Customer rule: minimal caps. A single run and the user's day total must both stay within limits. */
export function evaluateBudgetCaps(input: {
  chargedUsd: number;
  spentTodayUsd: number;
  runCapUsd: number;
  dailyCapUsd: number;
}): BudgetCapCheck {
  if (input.chargedUsd > input.runCapUsd) {
    return {
      ok: false,
      code: "RUN_CAP_EXCEEDED",
      message: `Стоимость $${input.chargedUsd.toFixed(2)} выше лимита на запуск $${input.runCapUsd.toFixed(2)}`,
    };
  }
  if (input.spentTodayUsd + input.chargedUsd > input.dailyCapUsd) {
    return {
      ok: false,
      code: "DAILY_CAP_EXCEEDED",
      message: `Дневной лимит $${input.dailyCapUsd.toFixed(2)} будет превышен (уже $${input.spentTodayUsd.toFixed(2)})`,
    };
  }
  return { ok: true };
}

/**
 * Canonical approval payload for a talent operation. Field order is fixed because the approval
 * stores sha256(JSON.stringify(payload)) and the server recomputes it at execution time.
 */
export function talentApprovalPayload(input: {
  operation: TalentOperation;
  talentId: string;
  talentVersion: string;
  generatedVoiceId?: string | null;
  chargedUsd: number;
}) {
  return {
    kind: "TALENT_OPERATION",
    operation: input.operation,
    talentId: input.talentId,
    talentVersion: input.talentVersion,
    generatedVoiceId: input.generatedVoiceId ?? null,
    chargedUsd: input.chargedUsd,
  };
}
