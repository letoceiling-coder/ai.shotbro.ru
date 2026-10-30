"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AssignCharacterTalentInput,
  AvatarProfile,
  CreateAvatarProfileInput,
  CreateVoiceProfileInput,
  LibraryVoice,
  MediaCapability,
  ProviderChain,
  TalentOperation,
  TalentQuoteResult,
  VoiceProfile,
} from "@shotbro/contracts";
import { CONSENT_TEXT_VERSION } from "@shotbro/contracts";
import { api, apiFetch } from "@/lib/api-client";

/** Workspace-level talent: one voice/avatar is reused across every project of the workspace. */
export const TALENT_KEYS = {
  voices: ["talent", "voices"] as const,
  libraryVoices: ["talent", "voices-library"] as const,
  avatars: ["talent", "avatars"] as const,
  chain: (c: MediaCapability) => ["talent", "provider-chain", c] as const,
};

export function useVoices() {
  return useQuery({
    queryKey: TALENT_KEYS.voices,
    queryFn: () => apiFetch("/api/v1/voices") as Promise<{ items: VoiceProfile[] }>,
  });
}

export function useLibraryVoices(enabled = true) {
  return useQuery({
    queryKey: TALENT_KEYS.libraryVoices,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => apiFetch("/api/v1/voices/library") as Promise<{ items: LibraryVoice[]; mock: boolean }>,
  });
}

export function useAvatars() {
  return useQuery({
    queryKey: TALENT_KEYS.avatars,
    queryFn: () => apiFetch("/api/v1/avatars") as Promise<{ items: AvatarProfile[] }>,
  });
}

export function useProviderChain(capability: MediaCapability) {
  return useQuery({
    queryKey: TALENT_KEYS.chain(capability),
    staleTime: 60_000,
    queryFn: () => apiFetch(`/api/v1/talent/provider-chain?capability=${capability}`) as Promise<ProviderChain>,
  });
}

function useInvalidateTalent() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: TALENT_KEYS.voices }),
      qc.invalidateQueries({ queryKey: TALENT_KEYS.avatars }),
    ]);
}

export function useCreateVoice() {
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: (body: CreateVoiceProfileInput) =>
      apiFetch("/api/v1/voices", { method: "POST", body: JSON.stringify(body) }) as Promise<VoiceProfile>,
    onSuccess: () => void invalidate(),
  });
}

export function useCreateAvatar() {
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: (body: CreateAvatarProfileInput) =>
      apiFetch("/api/v1/avatars", { method: "POST", body: JSON.stringify(body) }) as Promise<AvatarProfile>,
    onSuccess: () => void invalidate(),
  });
}

export function useArchiveTalent() {
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: "voice" | "avatar"; id: string }) =>
      apiFetch(`/api/v1/${kind === "voice" ? "voices" : "avatars"}/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateAvatar() {
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; defaultVoiceProfileId?: string | null; name?: string }) =>
      apiFetch(`/api/v1/avatars/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as Promise<AvatarProfile>,
    onSuccess: () => void invalidate(),
  });
}

/** Consent of the real person (voice clone / photo avatar). The text version is pinned by the server. */
export function useAttachConsent() {
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: ({ kind, id, consentAssetId }: { kind: "voice" | "avatar"; id: string; consentAssetId: string }) =>
      apiFetch(`/api/v1/${kind === "voice" ? "voices" : "avatars"}/${id}/consent`, {
        method: "POST",
        body: JSON.stringify({ consentAssetId, confirmed: true, textVersion: CONSENT_TEXT_VERSION }),
      }),
    onSuccess: () => void invalidate(),
  });
}

export type TalentQuoteRequest = {
  projectId: string;
  operation: TalentOperation;
  voiceProfileId?: string;
  avatarProfileId?: string;
  generatedVoiceId?: string;
};

/** Step 1: price + approval card in the project chat (budget is held for 30 minutes). Nothing runs yet. */
export function useQuoteTalent() {
  return useMutation({
    mutationFn: (body: TalentQuoteRequest) =>
      apiFetch("/api/v1/talent/operations/quote", { method: "POST", body: JSON.stringify(body) }) as Promise<TalentQuoteResult>,
  });
}

/**
 * Step 2: the user confirms the price. The server starts the job itself when the approval is decided;
 * a free REFERENCE avatar needs no approval and is started directly.
 */
export function useConfirmTalentQuote() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTalent();
  return useMutation({
    mutationFn: async ({ request, quote }: { request: TalentQuoteRequest; quote: TalentQuoteResult }) => {
      if (quote.free || !quote.approvalId) {
        return apiFetch("/api/v1/talent/operations", { method: "POST", body: JSON.stringify(request) });
      }
      return api.approvals.decide(quote.approvalId, "approve", {
        expectedVersion: quote.targetVersion ?? "",
        payloadHash: quote.payloadHash ?? "",
        idempotencyKey: `talent-ui:${quote.approvalId}`,
      });
    },
    onSuccess: (_r, { request }) => {
      void invalidate();
      void qc.invalidateQueries({ queryKey: ["messages"] });
      void qc.invalidateQueries({ queryKey: ["approvals", request.projectId] });
    },
  });
}

export function useRejectTalentQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (quote: TalentQuoteResult) =>
      quote.approvalId
        ? api.approvals.decide(quote.approvalId, "reject", {
            expectedVersion: quote.targetVersion ?? "",
            payloadHash: quote.payloadHash ?? "",
          })
        : Promise.resolve(null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useAssignTalent(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ characterId, ...body }: AssignCharacterTalentInput & { characterId: string }) =>
      apiFetch(`/api/v1/projects/${projectId}/characters/${characterId}/talent`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["characters", projectId] });
      void qc.invalidateQueries({ queryKey: ["storyboard", projectId] });
    },
  });
}

/** Uploaded files become usable only when processing finished (status READY). */
export async function waitAssetReady(assetId: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let delay = 800;
  while (Date.now() < deadline) {
    try {
      const a = (await apiFetch(`/api/v1/assets/${assetId}`)) as { status?: string };
      if (a.status === "READY") return;
      if (a.status === "FAILED" || a.status === "REJECTED") throw new Error("Файл не прошёл обработку");
    } catch (e) {
      if (e instanceof Error && e.message === "Файл не прошёл обработку") throw e;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 4000);
  }
  throw new Error("Файл обрабатывается дольше обычного. Повторите через минуту.");
}

export const TALENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Черновик",
  AWAITING_APPROVAL: "Ждёт подтверждения",
  CREATING: "Создаётся…",
  READY: "Готов",
  FAILED: "Ошибка",
  ARCHIVED: "В архиве",
};
