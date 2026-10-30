import type { AppEnv } from "@shotbro/config/env";
import { getFalConfig } from "@shotbro/config/vendor-providers";
import type { RunnableCanvasKind } from "@shotbro/contracts";
import { resolveMediaProviderChain } from "../providers/media-provider-chain.js";

/**
 * Phase 6E — price estimates for canvas nodes (USD). Conservative estimates shown before approval;
 * review against vendor price lists before the Phase 6G live tests.
 */
export type CanvasNodeQuote = {
  kind: RunnableCanvasKind;
  providerId: string;
  estimatedLiveUsd: number;
  chargedUsd: number;
  note: string;
  mock: boolean;
};

const round = (n: number) => Math.round(n * 100) / 100;

function imageProvider(env: AppEnv) {
  return getFalConfig(env).hasApiKey && env.FAL_PROVIDER_ENABLED ? "fal" : "openrouter";
}

export function quoteCanvasNode(
  env: AppEnv,
  input: { kind: RunnableCanvasKind; durationSeconds?: number; textLength?: number },
): CanvasNodeQuote {
  const mock = env.AI_MOCK_MODE;
  const seconds = Math.min(10, Math.max(1, input.durationSeconds ?? 5));
  let providerId: string;
  let usd: number;
  let note: string;
  switch (input.kind) {
    case "first_frame":
      providerId = imageProvider(env);
      usd = 0.04;
      note = "Первый кадр (1 изображение)";
      break;
    case "upscale":
      providerId = "magnific";
      usd = 0.1;
      note = "Апскейл изображения";
      break;
    case "scene_video":
      providerId = resolveMediaProviderChain(env, "SCENE_VIDEO").selected ?? "fal";
      usd = 0.08 * seconds;
      note = `Видео сцены ${seconds} с`;
      break;
    case "avatar_video":
      providerId = resolveMediaProviderChain(env, "AVATAR_VIDEO").selected ?? "heygen";
      usd = 0.05 * seconds;
      note = `Видео с аватаром ${seconds} с`;
      break;
    case "tts":
      providerId = "elevenlabs";
      usd = Math.max(0.01, (input.textLength ?? 0) * 0.0003);
      note = `Озвучка (${input.textLength ?? 0} символов)`;
      break;
    case "assembly":
    default:
      providerId = "local-ffmpeg";
      usd = 0;
      note = "Монтаж на нашем сервере — бесплатно";
      break;
  }
  const estimatedLiveUsd = round(usd);
  return {
    kind: input.kind,
    providerId: mock && providerId !== "local-ffmpeg" ? `mock-${providerId}` : providerId,
    estimatedLiveUsd,
    chargedUsd: mock ? 0 : estimatedLiveUsd,
    note: mock ? `${note}. Тестовый режим: списание $0` : note,
    mock,
  };
}

/**
 * Canonical approval payload for a canvas run. Field order is fixed: the approval stores
 * sha256(JSON.stringify(payload)) and the server recomputes it when the user approves.
 */
export function canvasApprovalPayload(input: {
  canvasId: string;
  items: Array<{ nodeId: string; kind: string; specHash: string; chargedUsd: number }>;
}) {
  const totalChargedUsd = round(input.items.reduce((s, i) => s + i.chargedUsd, 0));
  return {
    kind: "CANVAS_RUN",
    canvasId: input.canvasId,
    items: input.items.map((i) => ({ nodeId: i.nodeId, kind: i.kind, specHash: i.specHash, chargedUsd: i.chargedUsd })),
    totalChargedUsd,
  };
}
