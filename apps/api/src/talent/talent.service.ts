import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  AssignCharacterTalentInputSchema,
  AttachConsentInputSchema,
  CreateAvatarProfileInputSchema,
  CreateVoiceProfileInputSchema,
  UpdateAvatarProfileInputSchema,
  UpdateVoiceProfileInputSchema,
  type AvatarProfile,
  type LibraryVoice,
  type MediaCapability,
  type VoiceProfile,
} from "@shotbro/contracts";
import {
  ElevenLabsVoiceAdapter,
  ExecutionPolicyEngine,
  FetchHttpTransport,
  MOCK_LIBRARY_VOICES,
  resolveMediaProviderChain,
  resolveVoiceVendorState,
} from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { asset, auditEvent, avatarLook, avatarProfile, voiceProfile } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { CharacterContinuityService } from "../production/character-continuity.service";
import { ProjectsService } from "../projects/projects.service";

type VoiceRow = typeof voiceProfile.$inferSelect;
type AvatarRow = typeof avatarProfile.$inferSelect;
type LookRow = typeof avatarLook.$inferSelect;

function parse<T>(schema: { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } } }, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException({ code: "invalid_input", issues: r.error.issues });
  return r.data;
}

function consentOf(row: { consentAssetId: string | null; consentConfirmedAt: Date | null; consentTextVersion: string | null }) {
  if (!row.consentAssetId || !row.consentConfirmedAt || !row.consentTextVersion) return null;
  return {
    consentAssetId: row.consentAssetId,
    confirmedAt: row.consentConfirmedAt.toISOString(),
    textVersion: row.consentTextVersion,
  };
}

export function toVoiceDto(row: VoiceRow, mock: boolean): VoiceProfile {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    provider: "elevenlabs",
    providerVoiceId: row.providerVoiceId,
    kind: row.kind as VoiceProfile["kind"],
    labels: row.labels ?? {},
    settings: (row.settings ?? {}) as VoiceProfile["settings"],
    previewAssetId: row.previewAssetId,
    previewUrl: row.previewUrl,
    sampleAssetIds: row.sampleAssetIds ?? [],
    designPrompt: row.designPrompt,
    previews: ((row.metadata ?? {}) as { previews?: VoiceProfile["previews"] }).previews ?? [],
    lastError: ((row.metadata ?? {}) as { lastError?: string | null }).lastError ?? null,
    consent: consentOf(row),
    status: row.status as VoiceProfile["status"],
    mock,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAvatarDto(row: AvatarRow, looks: LookRow[], mock: boolean): AvatarProfile {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    kind: row.kind as AvatarProfile["kind"],
    provider: (row.provider ?? null) as AvatarProfile["provider"],
    providerGroupId: row.providerGroupId,
    sourceAssetIds: row.sourceAssetIds ?? [],
    defaultVoiceProfileId: row.defaultVoiceProfileId,
    consent: consentOf(row),
    status: row.status as AvatarProfile["status"],
    looks: looks.map((l) => ({
      id: l.id,
      avatarId: l.avatarId,
      providerLookId: l.providerLookId,
      label: l.label,
      previewAssetId: l.previewAssetId,
      isDefault: l.isDefault,
      createdAt: l.createdAt.toISOString(),
    })),
    mock,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Phase 6A — reusable avatars and voices (workspace scope).
 * Only free actions live here (drafts, library voices, consent, links). Paid actions
 * (clone, design, train, generate) go through approval + provider jobs in 6B/6C.
 */
@Injectable()
export class TalentService {
  private readonly env = loadEnvFromProcess();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(CharacterContinuityService) private readonly characters: CharacterContinuityService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  private get mock() {
    return this.env.AI_MOCK_MODE;
  }

  private async workspaceOf(userId: string) {
    // Same personal workspace the project list uses (created on first use).
    const ws = await this.projects.ensurePersonalWorkspace(userId, "Моё пространство");
    await this.access.assertWorkspaceAccess(this.db, userId, ws.id);
    return ws.id;
  }

  /** Assets must be READY, not deleted, in the same workspace and of the expected media type. */
  private async assertAssets(workspaceId: string, ids: string[], mimePrefix: "audio/" | "image/" | null) {
    if (!ids.length) return;
    const unique = [...new Set(ids)];
    const rows = await this.db
      .select({ id: asset.id, workspaceId: asset.workspaceId, status: asset.status, mimeType: asset.mimeType })
      .from(asset)
      .where(and(inArray(asset.id, unique), isNull(asset.deletedAt)));
    for (const id of unique) {
      const row = rows.find((r) => r.id === id);
      // Same error for "missing" and "other workspace": no cross-tenant existence oracle.
      if (!row || row.workspaceId !== workspaceId) throw new ForbiddenException({ code: "asset_not_accessible", assetId: id });
      if (row.status !== "READY") throw new BadRequestException({ code: "asset_not_ready", assetId: id });
      if (mimePrefix && !row.mimeType.startsWith(mimePrefix)) {
        throw new BadRequestException({ code: "asset_wrong_type", assetId: id, expected: mimePrefix });
      }
    }
  }

  private async audit(workspaceId: string, actorId: string, action: string, resourceType: string, resourceId: string, metadata: Record<string, unknown>) {
    await this.db.insert(auditEvent).values({ id: uuid(), workspaceId, actorId, action, resourceType, resourceId, metadata });
  }

  // ---------- provider routing ----------

  providerChain(capability: MediaCapability) {
    return resolveMediaProviderChain(this.env, capability);
  }

  // ---------- voices ----------

  /** ElevenLabs catalog. Mock fixtures unless live execution + vendor switch are on. */
  async libraryVoices(): Promise<{ items: LibraryVoice[]; mock: boolean }> {
    const vendor = resolveVoiceVendorState(this.env);
    const live = new ExecutionPolicyEngine(this.env).resolveMode() === "LIVE_APPROVED" && vendor.vendorEnabled && vendor.hasApiKey;
    if (!live) return { items: MOCK_LIBRARY_VOICES, mock: true };
    const items = await new ElevenLabsVoiceAdapter(this.env, new FetchHttpTransport()).listVoices();
    return { items, mock: false };
  }

  async listVoices(userId: string, opts: { includeArchived?: boolean } = {}) {
    const workspaceId = await this.workspaceOf(userId);
    const conds = [eq(voiceProfile.workspaceId, workspaceId)];
    if (!opts.includeArchived) conds.push(isNull(voiceProfile.archivedAt));
    const rows = await this.db.select().from(voiceProfile).where(and(...conds)).orderBy(desc(voiceProfile.updatedAt));
    return { items: rows.map((r) => toVoiceDto(r, this.mock)) };
  }

  private async loadVoice(userId: string, voiceId: string) {
    const workspaceId = await this.workspaceOf(userId);
    const [row] = await this.db.select().from(voiceProfile).where(eq(voiceProfile.id, voiceId)).limit(1);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundException({ code: "voice_not_found" });
    return row;
  }

  async getVoice(userId: string, voiceId: string) {
    return toVoiceDto(await this.loadVoice(userId, voiceId), this.mock);
  }

  async createVoice(userId: string, body: unknown) {
    const input = parse(CreateVoiceProfileInputSchema, body);
    const workspaceId = await this.workspaceOf(userId);
    const id = uuid();
    const base = { id, workspaceId, ownerId: userId, name: input.name, labels: (input.labels ?? {}) as Record<string, string> };

    if (input.kind === "LIBRARY") {
      // Picking a catalog voice costs nothing → ready at once.
      await this.db.insert(voiceProfile).values({
        ...base,
        kind: "LIBRARY",
        providerVoiceId: input.providerVoiceId,
        previewUrl: input.previewUrl ?? null,
        settings: input.settings ?? {},
        status: "READY",
      });
    } else if (input.kind === "CLONED") {
      await this.assertAssets(workspaceId, input.sampleAssetIds, "audio/");
      await this.db.insert(voiceProfile).values({
        ...base,
        kind: "CLONED",
        description: input.description ?? null,
        sampleAssetIds: input.sampleAssetIds,
        metadata: { removeBackgroundNoise: input.removeBackgroundNoise ?? false },
        status: "DRAFT",
      });
    } else {
      await this.db.insert(voiceProfile).values({ ...base, kind: "DESIGNED", designPrompt: input.designPrompt, status: "DRAFT" });
    }
    return this.getVoice(userId, id);
  }

  async updateVoice(userId: string, voiceId: string, body: unknown) {
    const input = parse(UpdateVoiceProfileInputSchema, body);
    const row = await this.loadVoice(userId, voiceId);
    if (row.archivedAt) throw new BadRequestException({ code: "voice_archived" });
    await this.db
      .update(voiceProfile)
      .set({
        name: input.name ?? row.name,
        description: input.description ?? row.description,
        labels: (input.labels ?? row.labels) as Record<string, string>,
        settings: { ...(row.settings ?? {}), ...(input.settings ?? {}) },
        updatedAt: new Date(),
      })
      .where(eq(voiceProfile.id, voiceId));
    return this.getVoice(userId, voiceId);
  }

  async archiveVoice(userId: string, voiceId: string) {
    await this.loadVoice(userId, voiceId);
    await this.db.update(voiceProfile).set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() }).where(eq(voiceProfile.id, voiceId));
    return this.getVoice(userId, voiceId);
  }

  async attachVoiceConsent(userId: string, voiceId: string, body: unknown) {
    const input = parse(AttachConsentInputSchema, body);
    const row = await this.loadVoice(userId, voiceId);
    if (row.kind !== "CLONED") throw new BadRequestException({ code: "consent_not_applicable" });
    await this.assertAssets(row.workspaceId, [input.consentAssetId], null);
    const now = new Date();
    await this.db
      .update(voiceProfile)
      .set({ consentAssetId: input.consentAssetId, consentConfirmedAt: now, consentTextVersion: input.textVersion, updatedAt: now })
      .where(eq(voiceProfile.id, voiceId));
    await this.audit(row.workspaceId, userId, "talent.consent.attached", "voice_profile", voiceId, {
      consentAssetId: input.consentAssetId,
      textVersion: input.textVersion,
    });
    return this.getVoice(userId, voiceId);
  }

  // ---------- avatars ----------

  private async looksFor(avatarIds: string[]) {
    if (!avatarIds.length) return [] as LookRow[];
    return this.db.select().from(avatarLook).where(inArray(avatarLook.avatarId, avatarIds)).orderBy(asc(avatarLook.createdAt));
  }

  async listAvatars(userId: string, opts: { includeArchived?: boolean } = {}) {
    const workspaceId = await this.workspaceOf(userId);
    const conds = [eq(avatarProfile.workspaceId, workspaceId)];
    if (!opts.includeArchived) conds.push(isNull(avatarProfile.archivedAt));
    const rows = await this.db.select().from(avatarProfile).where(and(...conds)).orderBy(desc(avatarProfile.updatedAt));
    const looks = await this.looksFor(rows.map((r) => r.id));
    return { items: rows.map((r) => toAvatarDto(r, looks.filter((l) => l.avatarId === r.id), this.mock)) };
  }

  private async loadAvatar(userId: string, avatarId: string) {
    const workspaceId = await this.workspaceOf(userId);
    const [row] = await this.db.select().from(avatarProfile).where(eq(avatarProfile.id, avatarId)).limit(1);
    if (!row || row.workspaceId !== workspaceId) throw new NotFoundException({ code: "avatar_not_found" });
    return row;
  }

  async getAvatar(userId: string, avatarId: string) {
    const row = await this.loadAvatar(userId, avatarId);
    return toAvatarDto(row, await this.looksFor([row.id]), this.mock);
  }

  private async assertVoiceInWorkspace(workspaceId: string, voiceId: string) {
    const [v] = await this.db.select().from(voiceProfile).where(eq(voiceProfile.id, voiceId)).limit(1);
    if (!v || v.workspaceId !== workspaceId || v.archivedAt) throw new BadRequestException({ code: "voice_not_accessible" });
  }

  async createAvatar(userId: string, body: unknown) {
    const input = parse(CreateAvatarProfileInputSchema, body);
    const workspaceId = await this.workspaceOf(userId);
    await this.assertAssets(workspaceId, input.sourceAssetIds, "image/");
    if (input.defaultVoiceProfileId) await this.assertVoiceInWorkspace(workspaceId, input.defaultVoiceProfileId);
    // Persistent photo avatar only when HeyGen is the selected route; otherwise photos act as references.
    const chain = this.providerChain("AVATAR_TRAIN");
    const id = uuid();
    await this.db.insert(avatarProfile).values({
      id,
      workspaceId,
      ownerId: userId,
      name: input.name,
      description: input.description ?? null,
      kind: chain.selected === "heygen" ? "PHOTO" : "REFERENCE",
      provider: chain.selected,
      sourceAssetIds: input.sourceAssetIds,
      defaultVoiceProfileId: input.defaultVoiceProfileId ?? null,
      status: "DRAFT",
      metadata: { providerChain: chain.chain },
    });
    return this.getAvatar(userId, id);
  }

  async updateAvatar(userId: string, avatarId: string, body: unknown) {
    const input = parse(UpdateAvatarProfileInputSchema, body);
    const row = await this.loadAvatar(userId, avatarId);
    if (row.archivedAt) throw new BadRequestException({ code: "avatar_archived" });
    if (input.defaultVoiceProfileId) await this.assertVoiceInWorkspace(row.workspaceId, input.defaultVoiceProfileId);
    await this.db
      .update(avatarProfile)
      .set({
        name: input.name ?? row.name,
        description: input.description ?? row.description,
        defaultVoiceProfileId:
          input.defaultVoiceProfileId === undefined ? row.defaultVoiceProfileId : input.defaultVoiceProfileId,
        updatedAt: new Date(),
      })
      .where(eq(avatarProfile.id, avatarId));
    return this.getAvatar(userId, avatarId);
  }

  async archiveAvatar(userId: string, avatarId: string) {
    await this.loadAvatar(userId, avatarId);
    await this.db.update(avatarProfile).set({ status: "ARCHIVED", archivedAt: new Date(), updatedAt: new Date() }).where(eq(avatarProfile.id, avatarId));
    return this.getAvatar(userId, avatarId);
  }

  async attachAvatarConsent(userId: string, avatarId: string, body: unknown) {
    const input = parse(AttachConsentInputSchema, body);
    const row = await this.loadAvatar(userId, avatarId);
    await this.assertAssets(row.workspaceId, [input.consentAssetId], null);
    const now = new Date();
    await this.db
      .update(avatarProfile)
      .set({ consentAssetId: input.consentAssetId, consentConfirmedAt: now, consentTextVersion: input.textVersion, updatedAt: now })
      .where(eq(avatarProfile.id, avatarId));
    await this.audit(row.workspaceId, userId, "talent.consent.attached", "avatar_profile", avatarId, {
      consentAssetId: input.consentAssetId,
      textVersion: input.textVersion,
    });
    return this.getAvatar(userId, avatarId);
  }

  // ---------- project character links ----------

  async assignToCharacter(userId: string, projectId: string, characterId: string, body: unknown) {
    const input = parse(AssignCharacterTalentInputSchema, body);
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const list = await this.characters.list(userId, projectId);
    const character = list.items.find((c) => c.id === characterId);
    if (!character) throw new NotFoundException({ code: "character_not_found" });

    if (input.voiceProfileId) await this.assertVoiceInWorkspace(workspaceId, input.voiceProfileId);
    if (input.avatarProfileId) {
      const [a] = await this.db.select().from(avatarProfile).where(eq(avatarProfile.id, input.avatarProfileId)).limit(1);
      if (!a || a.workspaceId !== workspaceId || a.archivedAt) throw new BadRequestException({ code: "avatar_not_accessible" });
    }
    if (input.avatarLookId) {
      const avatarId = input.avatarProfileId ?? character.avatarProfileId;
      const [l] = await this.db.select().from(avatarLook).where(eq(avatarLook.id, input.avatarLookId)).limit(1);
      if (!l || !avatarId || l.avatarId !== avatarId) throw new BadRequestException({ code: "look_not_in_avatar" });
    }

    const patch: Record<string, string | null> = {};
    for (const k of ["voiceProfileId", "avatarProfileId", "avatarLookId"] as const) {
      if (k in input) patch[k] = input[k] ?? null;
    }
    // Changing the avatar invalidates a look that belonged to the old one.
    if ("avatarProfileId" in input && !("avatarLookId" in input) && input.avatarProfileId !== character.avatarProfileId) {
      patch.avatarLookId = null;
    }
    return this.characters.upsert(userId, projectId, { id: characterId, name: character.name, ...patch } as Parameters<
      CharacterContinuityService["upsert"]
    >[2]);
  }
}
