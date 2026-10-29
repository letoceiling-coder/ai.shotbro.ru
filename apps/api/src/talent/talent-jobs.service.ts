import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import { StartTalentOperationInputSchema, type TalentJob, type TalentOperation } from "@shotbro/contracts";
import { liveTalentBlockers } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { approval, avatarLook, avatarProfile, eventLog, providerJob, voiceProfile } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { MediaQueueService } from "../queue/media-queue.service";

const ACTIVE = new Set(["CREATED", "AUTHORIZED", "SUBMITTING", "SUBMITTED", "QUEUED", "RUNNING"]);
const RESTARTABLE = new Set(["DRAFT", "FAILED"]);

type JobRow = typeof providerJob.$inferSelect;

function toJobDto(row: JobRow): TalentJob {
  const meta = (row.metadata ?? {}) as { talentType?: "voice" | "avatar"; talentId?: string; mock?: boolean };
  return {
    id: row.id,
    projectId: row.projectId,
    operation: row.operation as TalentOperation,
    providerId: row.providerId,
    status: row.status,
    talentType: meta.talentType ?? "voice",
    talentId: meta.talentId ?? "",
    failureCode: row.failureCode,
    mock: Boolean(meta.mock),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Phase 6B: starts paid talent operations as provider jobs executed by the worker.
 * Mock mode: runs with offline mocks (free). Live mode: needs every gate incl. an approved cost (6C).
 */
@Injectable()
export class TalentJobsService {
  private readonly env = loadEnvFromProcess();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(MediaQueueService) private readonly queue: MediaQueueService,
  ) {}

  private async assertNotBusy(providerJobId: string | null) {
    if (!providerJobId) return;
    const [j] = await this.db.select().from(providerJob).where(eq(providerJob.id, providerJobId)).limit(1);
    if (j && ACTIVE.has(j.status)) throw new ConflictException({ code: "talent_busy", providerJobId: j.id });
  }

  private async approved(approvalId: string | undefined, projectId: string) {
    if (!approvalId) return false;
    const [a] = await this.db
      .select()
      .from(approval)
      .where(and(eq(approval.id, approvalId), eq(approval.projectId, projectId)))
      .limit(1);
    return a?.status === "APPROVED" && (!a.expiresAt || a.expiresAt > new Date());
  }

  async start(userId: string, body: unknown) {
    const parsed = StartTalentOperationInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_input", issues: parsed.error.issues });
    const input = parsed.data;
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, input.projectId);

    const isVoice = input.operation !== "AVATAR_TRAIN";
    const talentId = isVoice ? input.voiceProfileId : input.avatarProfileId;
    if (!talentId) throw new BadRequestException({ code: isVoice ? "voice_required" : "avatar_required" });

    let versionStamp: string;
    let providerJobId: string | null;
    if (isVoice) {
      const [v] = await this.db.select().from(voiceProfile).where(eq(voiceProfile.id, talentId)).limit(1);
      if (!v || v.workspaceId !== workspaceId || v.archivedAt) throw new NotFoundException({ code: "voice_not_found" });
      if (!RESTARTABLE.has(v.status)) throw new ConflictException({ code: "talent_not_restartable", status: v.status });
      const meta = (v.metadata ?? {}) as { previews?: Array<{ generatedVoiceId: string }> };
      if (input.operation === "VOICE_CLONE") {
        if (v.kind !== "CLONED") throw new BadRequestException({ code: "wrong_voice_kind" });
        if (!v.consentAssetId || !v.consentConfirmedAt) throw new BadRequestException({ code: "consent_required" });
        if (!(v.sampleAssetIds ?? []).length) throw new BadRequestException({ code: "samples_required" });
      } else if (input.operation === "VOICE_DESIGN") {
        if (v.kind !== "DESIGNED") throw new BadRequestException({ code: "wrong_voice_kind" });
      } else {
        if (v.kind !== "DESIGNED") throw new BadRequestException({ code: "wrong_voice_kind" });
        if (!input.generatedVoiceId || !(meta.previews ?? []).some((p) => p.generatedVoiceId === input.generatedVoiceId)) {
          throw new BadRequestException({ code: "preview_not_found" });
        }
      }
      versionStamp = v.updatedAt.toISOString();
      providerJobId = v.providerJobId;
    } else {
      const [a] = await this.db.select().from(avatarProfile).where(eq(avatarProfile.id, talentId)).limit(1);
      if (!a || a.workspaceId !== workspaceId || a.archivedAt) throw new NotFoundException({ code: "avatar_not_found" });
      if (!RESTARTABLE.has(a.status)) throw new ConflictException({ code: "talent_not_restartable", status: a.status });
      if (a.kind === "REFERENCE") return this.readyReferenceAvatar(a, input.projectId);
      if (!a.consentAssetId || !a.consentConfirmedAt) throw new BadRequestException({ code: "consent_required" });
      versionStamp = a.updatedAt.toISOString();
      providerJobId = a.providerJobId;
    }
    await this.assertNotBusy(providerJobId);

    const approved = await this.approved(input.approvalId, input.projectId);
    const blockers = liveTalentBlockers(this.env, input.operation, { approved });
    const mock = this.env.AI_MOCK_MODE;
    if (!mock && blockers.length) {
      throw new ConflictException({ code: "approval_required", reasons: blockers });
    }

    const vendor = isVoice ? "elevenlabs" : "heygen";
    const idempotencyKey = createHash("sha256")
      .update([input.operation, talentId, input.generatedVoiceId ?? "", versionStamp].join("|"))
      .digest("hex");
    const [dup] = await this.db.select().from(providerJob).where(eq(providerJob.idempotencyKey, idempotencyKey)).limit(1);
    if (dup) return toJobDto(dup);

    const id = uuid();
    await this.db.insert(providerJob).values({
      id,
      projectId: input.projectId,
      providerId: mock ? `mock-${vendor}` : vendor,
      modelId: input.operation === "AVATAR_TRAIN" ? "heygen-photo-avatar" : input.operation === "VOICE_CLONE" ? "ivc" : "eleven_multilingual_ttv_v2",
      operation: input.operation,
      status: "CREATED",
      idempotencyKey,
      inputHash: idempotencyKey,
      metadata: {
        talentType: isVoice ? "voice" : "avatar",
        talentId,
        workspaceId,
        ownerId: userId,
        generatedVoiceId: input.generatedVoiceId,
        approvalId: input.approvalId,
        mock,
      },
    });
    const table = isVoice ? voiceProfile : avatarProfile;
    await this.db
      .update(table)
      .set({ status: "CREATING", providerJobId: id, updatedAt: new Date() } as never)
      .where(eq(table.id, talentId));
    await this.db.insert(eventLog).values({
      id: uuid(),
      workspaceId,
      projectId: input.projectId,
      resourceId: talentId,
      type: "talent.updated",
      payload: { talentType: isVoice ? "voice" : "avatar", talentId, status: "CREATING", providerJobId: id },
    });
    await this.queue.enqueueTalentJob(id);
    const [row] = await this.db.select().from(providerJob).where(eq(providerJob.id, id)).limit(1);
    return toJobDto(row!);
  }

  /** REFERENCE avatars need no provider: each source photo becomes a look. Free and instant. */
  private async readyReferenceAvatar(a: typeof avatarProfile.$inferSelect, projectId: string) {
    await this.db.delete(avatarLook).where(eq(avatarLook.avatarId, a.id));
    for (const [i, assetId] of (a.sourceAssetIds ?? []).entries()) {
      await this.db.insert(avatarLook).values({
        id: uuid(),
        avatarId: a.id,
        providerLookId: null,
        label: `Фото ${i + 1}`,
        previewAssetId: assetId,
        isDefault: i === 0,
      });
    }
    await this.db.update(avatarProfile).set({ status: "READY", updatedAt: new Date() }).where(eq(avatarProfile.id, a.id));
    await this.db.insert(eventLog).values({
      id: uuid(),
      workspaceId: a.workspaceId,
      projectId,
      resourceId: a.id,
      type: "talent.updated",
      payload: { talentType: "avatar", talentId: a.id, status: "READY" },
    });
    return { id: null, talentType: "avatar" as const, talentId: a.id, status: "READY", operation: "AVATAR_TRAIN" as const, mock: this.env.AI_MOCK_MODE };
  }

  async get(userId: string, jobId: string) {
    const [row] = await this.db.select().from(providerJob).where(eq(providerJob.id, jobId)).limit(1);
    const meta = (row?.metadata ?? {}) as { talentType?: string };
    if (!row || !meta.talentType) throw new NotFoundException({ code: "job_not_found" });
    await this.access.assertProjectAccess(this.db, userId, row.projectId);
    return toJobDto(row);
  }
}
