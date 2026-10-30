import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { and, asc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import {
  StartTalentOperationInputSchema,
  TalentQuoteInputSchema,
  type TalentJob,
  type TalentOperation,
  type TalentQuoteResult,
} from "@shotbro/contracts";
import { evaluateBudgetCaps, liveTalentBlockers, quoteTalentOperation, talentApprovalPayload } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import {
  approval,
  avatarLook,
  avatarProfile,
  budgetReservation,
  conversation,
  costLedgerEntry,
  eventLog,
  providerJob,
  voiceProfile,
} from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { MediaQueueService } from "../queue/media-queue.service";

const ACTIVE = new Set(["CREATED", "AUTHORIZED", "SUBMITTING", "SUBMITTED", "QUEUED", "RUNNING"]);
const RESTARTABLE = new Set(["DRAFT", "FAILED"]);
const QUOTE_TTL_MS = 30 * 60_000;
export const TALENT_APPROVAL_TARGET = "TALENT_OPERATION";

const OPERATION_TITLE: Record<TalentOperation, string> = {
  VOICE_DESIGN: "Создать 3 варианта голоса по описанию",
  VOICE_SAVE: "Сохранить выбранный вариант голоса",
  VOICE_CLONE: "Клонировать голос по записи",
  AVATAR_TRAIN: "Обучить фото-аватар",
};

type JobRow = typeof providerJob.$inferSelect;
type Target = {
  isVoice: boolean;
  talentId: string;
  talentName: string;
  versionStamp: string;
  providerJobId: string | null;
  freeReferenceAvatar?: typeof avatarProfile.$inferSelect;
};

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

function quoteKey(approvalId: string) {
  return `talent-quote:${approvalId}`;
}

/**
 * Phase 6B/6C: paid talent operations.
 * Protocol: quote (price + approval card in chat, budget held) → user approves → server starts the
 * job → worker executes and captures/releases the reservation. Nothing paid runs without an
 * APPROVED approval whose payload hash still matches the talent and the quoted price.
 */
@Injectable()
export class TalentJobsService implements OnModuleInit {
  private readonly env = loadEnvFromProcess();
  private readonly log = new Logger(TalentJobsService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(MediaQueueService) private readonly queue: MediaQueueService,
    @Inject(ApprovalsService) private readonly approvals: ApprovalsService,
  ) {}

  onModuleInit() {
    this.approvals.registerTargetHandler(TALENT_APPROVAL_TARGET, (approvalId, status, userId) =>
      this.onApprovalDecided(approvalId, status, userId),
    );
  }

  // ---------- shared checks ----------

  private async loadTarget(
    workspaceId: string,
    input: { operation: TalentOperation; voiceProfileId?: string; avatarProfileId?: string; generatedVoiceId?: string },
  ): Promise<Target> {
    const isVoice = input.operation !== "AVATAR_TRAIN";
    const talentId = isVoice ? input.voiceProfileId : input.avatarProfileId;
    if (!talentId) throw new BadRequestException({ code: isVoice ? "voice_required" : "avatar_required" });

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
      return { isVoice, talentId, talentName: v.name, versionStamp: v.updatedAt.toISOString(), providerJobId: v.providerJobId };
    }

    const [a] = await this.db.select().from(avatarProfile).where(eq(avatarProfile.id, talentId)).limit(1);
    if (!a || a.workspaceId !== workspaceId || a.archivedAt) throw new NotFoundException({ code: "avatar_not_found" });
    if (!RESTARTABLE.has(a.status)) throw new ConflictException({ code: "talent_not_restartable", status: a.status });
    const target: Target = { isVoice, talentId, talentName: a.name, versionStamp: a.updatedAt.toISOString(), providerJobId: a.providerJobId };
    if (a.kind === "REFERENCE") return { ...target, freeReferenceAvatar: a };
    if (!a.consentAssetId || !a.consentConfirmedAt) throw new BadRequestException({ code: "consent_required" });
    return target;
  }

  private async assertNotBusy(providerJobId: string | null) {
    if (!providerJobId) return;
    const [j] = await this.db.select().from(providerJob).where(eq(providerJob.id, providerJobId)).limit(1);
    if (j && ACTIVE.has(j.status)) throw new ConflictException({ code: "talent_busy", providerJobId: j.id });
  }

  /** USD the user already committed today (held or captured talent and canvas reservations). */
  private async spentTodayUsd(userId: string) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({ total: sql<number>`coalesce(sum(${budgetReservation.amountUsd}), 0)` })
      .from(budgetReservation)
      .where(
        and(
          eq(budgetReservation.createdBy, userId),
          or(like(budgetReservation.reason, "talent:%"), like(budgetReservation.reason, "canvas:%")),
          inArray(budgetReservation.status, ["HELD", "CAPTURED"]),
          gte(budgetReservation.createdAt, dayStart),
        ),
      );
    return Number(row?.total ?? 0);
  }

  private async conversationFor(projectId: string, conversationId?: string) {
    if (conversationId) {
      const [c] = await this.db.select().from(conversation).where(eq(conversation.id, conversationId)).limit(1);
      if (!c || c.projectId !== projectId) throw new BadRequestException({ code: "conversation_not_found" });
      return c.id;
    }
    const [c] = await this.db
      .select()
      .from(conversation)
      .where(eq(conversation.projectId, projectId))
      .orderBy(asc(conversation.createdAt))
      .limit(1);
    if (!c) throw new BadRequestException({ code: "conversation_required" });
    return c.id;
  }

  private async releaseReservation(reservationId: string, reason: string) {
    const [r] = await this.db.select().from(budgetReservation).where(eq(budgetReservation.id, reservationId)).limit(1);
    if (!r || r.status !== "HELD") return;
    await this.db
      .update(budgetReservation)
      .set({ status: "RELEASED", updatedAt: new Date() })
      .where(and(eq(budgetReservation.id, reservationId), eq(budgetReservation.status, "HELD")));
    await this.db.insert(costLedgerEntry).values({
      id: uuid(),
      projectId: r.projectId,
      reservationId: r.id,
      entryType: "RELEASE",
      amountUsd: r.amountUsd,
      source: this.env.AI_MOCK_MODE ? "mock" : "talent",
      mock: this.env.AI_MOCK_MODE ? 1 : 0,
      metadata: { reason },
    });
  }

  // ---------- quote ----------

  async quote(userId: string, body: unknown): Promise<TalentQuoteResult> {
    const parsed = TalentQuoteInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_input", issues: parsed.error.issues });
    const input = parsed.data;
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, input.projectId);
    const target = await this.loadTarget(workspaceId, input);
    await this.assertNotBusy(target.providerJobId);

    if (target.freeReferenceAvatar) {
      return {
        approvalId: null,
        messageId: null,
        payloadHash: null,
        targetVersion: null,
        operation: input.operation,
        providerId: "local",
        estimatedLiveUsd: 0,
        chargedUsd: 0,
        priceStatus: "FREE",
        note: "Фото станут образами аватара без обучения — бесплатно",
        mock: this.env.AI_MOCK_MODE,
        free: true,
      };
    }

    const q = quoteTalentOperation(this.env, input.operation);
    const caps = evaluateBudgetCaps({
      chargedUsd: q.chargedUsd,
      spentTodayUsd: await this.spentTodayUsd(userId),
      runCapUsd: this.env.MEDIA_RUN_MAX_COST_USD,
      dailyCapUsd: this.env.MEDIA_USER_DAILY_MAX_USD,
    });
    if (!caps.ok) throw new ConflictException({ code: caps.code.toLowerCase(), message: caps.message });

    const conversationId = await this.conversationFor(input.projectId, input.conversationId);
    const payload = talentApprovalPayload({
      operation: input.operation,
      talentId: target.talentId,
      talentVersion: target.versionStamp,
      generatedVoiceId: input.generatedVoiceId,
      chargedUsd: q.chargedUsd,
    });
    const price = q.estimatedLiveUsd > 0 ? `≈ $${q.estimatedLiveUsd.toFixed(2)}` : "$0";
    const created = await this.approvals.create(userId, input.projectId, {
      conversationId,
      title: `${OPERATION_TITLE[input.operation]} «${target.talentName}» — ${price}${q.mock ? " (тест: $0)" : ""}`,
      description: `${q.note}. Списание только после вашего подтверждения.`,
      targetType: TALENT_APPROVAL_TARGET,
      targetId: target.talentId,
      targetVersion: target.versionStamp,
      payload,
    });

    const reservationId = uuid();
    await this.db.insert(budgetReservation).values({
      id: reservationId,
      projectId: input.projectId,
      idempotencyKey: quoteKey(created.approvalId),
      amountUsd: q.chargedUsd,
      status: "HELD",
      reason: `talent:${input.operation}`,
      createdBy: userId,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      metadata: {
        approvalId: created.approvalId,
        operation: input.operation,
        talentType: target.isVoice ? "voice" : "avatar",
        talentId: target.talentId,
        generatedVoiceId: input.generatedVoiceId ?? null,
        quote: q,
      },
    });
    await this.db.insert(costLedgerEntry).values({
      id: uuid(),
      projectId: input.projectId,
      reservationId,
      entryType: "RESERVE",
      amountUsd: q.chargedUsd,
      source: q.mock ? "mock" : q.providerId,
      mock: q.mock ? 1 : 0,
      metadata: { approvalId: created.approvalId, operation: input.operation, estimatedLiveUsd: q.estimatedLiveUsd },
    });

    return {
      approvalId: created.approvalId,
      messageId: created.messageId,
      payloadHash: created.payloadHash,
      targetVersion: created.targetVersion,
      operation: input.operation,
      providerId: q.providerId,
      estimatedLiveUsd: q.estimatedLiveUsd,
      chargedUsd: q.chargedUsd,
      priceStatus: q.priceStatus,
      note: q.note,
      mock: q.mock,
      free: false,
    };
  }

  // ---------- start (only with a valid approval) ----------

  async start(userId: string, body: unknown) {
    const parsed = StartTalentOperationInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_input", issues: parsed.error.issues });
    const input = parsed.data;
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, input.projectId);
    const target = await this.loadTarget(workspaceId, input);
    if (target.freeReferenceAvatar) return this.readyReferenceAvatar(target.freeReferenceAvatar, input.projectId);

    if (!input.approvalId) throw new ConflictException({ code: "approval_required", reasons: ["no approved cost confirmation"] });
    const [appr] = await this.db.select().from(approval).where(eq(approval.id, input.approvalId)).limit(1);
    if (
      !appr ||
      appr.projectId !== input.projectId ||
      appr.targetType !== TALENT_APPROVAL_TARGET ||
      appr.targetId !== target.talentId ||
      appr.status !== "APPROVED"
    ) {
      throw new ConflictException({ code: "approval_required", reasons: ["approval missing, not approved or for another target"] });
    }

    // Single use: the same approval always maps to the same job.
    const idempotencyKey = createHash("sha256").update(`talent-approval:${appr.id}`).digest("hex");
    const [dup] = await this.db.select().from(providerJob).where(eq(providerJob.idempotencyKey, idempotencyKey)).limit(1);
    if (dup) return toJobDto(dup);

    const [reservation] = await this.db
      .select()
      .from(budgetReservation)
      .where(eq(budgetReservation.idempotencyKey, quoteKey(appr.id)))
      .limit(1);
    if (!reservation || reservation.status !== "HELD") throw new ConflictException({ code: "quote_missing" });
    if (reservation.expiresAt && reservation.expiresAt < new Date()) {
      await this.releaseReservation(reservation.id, "quote_expired");
      throw new ConflictException({ code: "quote_expired" });
    }
    const expected = this.approvals.hashPayload(
      talentApprovalPayload({
        operation: input.operation,
        talentId: target.talentId,
        talentVersion: target.versionStamp,
        generatedVoiceId: input.generatedVoiceId,
        chargedUsd: reservation.amountUsd,
      }),
    );
    if (appr.payloadHash !== expected || appr.targetVersion !== target.versionStamp) {
      // Talent, operation or choice changed after the user saw the price → ask again.
      await this.releaseReservation(reservation.id, "approval_mismatch");
      throw new ConflictException({ code: "approval_mismatch" });
    }

    await this.assertNotBusy(target.providerJobId);
    const mock = this.env.AI_MOCK_MODE;
    const blockers = liveTalentBlockers(this.env, input.operation, { approved: true });
    if (!mock && blockers.length) {
      await this.releaseReservation(reservation.id, "live_blocked");
      throw new ConflictException({ code: "live_blocked", reasons: blockers });
    }

    const vendor = target.isVoice ? "elevenlabs" : "heygen";
    const id = uuid();
    await this.db.insert(providerJob).values({
      id,
      projectId: input.projectId,
      providerId: mock ? `mock-${vendor}` : vendor,
      modelId: input.operation === "AVATAR_TRAIN" ? "heygen-photo-avatar" : input.operation === "VOICE_CLONE" ? "ivc" : "eleven_multilingual_ttv_v2",
      operation: input.operation,
      status: "CREATED",
      idempotencyKey,
      inputHash: expected,
      estimatedCost: String(reservation.amountUsd),
      metadata: {
        talentType: target.isVoice ? "voice" : "avatar",
        talentId: target.talentId,
        workspaceId,
        ownerId: userId,
        generatedVoiceId: input.generatedVoiceId,
        approvalId: appr.id,
        reservationId: reservation.id,
        mock,
      },
    });
    const table = target.isVoice ? voiceProfile : avatarProfile;
    await this.db
      .update(table)
      .set({ status: "CREATING", providerJobId: id, updatedAt: new Date() } as never)
      .where(eq(table.id, target.talentId));
    await this.db.insert(eventLog).values({
      id: uuid(),
      workspaceId,
      projectId: input.projectId,
      resourceId: target.talentId,
      type: "talent.updated",
      payload: { talentType: target.isVoice ? "voice" : "avatar", talentId: target.talentId, status: "CREATING", providerJobId: id },
    });
    await this.queue.enqueueTalentJob(id);
    const [row] = await this.db.select().from(providerJob).where(eq(providerJob.id, id)).limit(1);
    return toJobDto(row!);
  }

  /** Called by ApprovalsService after the user decides on a TALENT_OPERATION card. */
  async onApprovalDecided(approvalId: string, status: string, userId: string) {
    const [reservation] = await this.db
      .select()
      .from(budgetReservation)
      .where(eq(budgetReservation.idempotencyKey, quoteKey(approvalId)))
      .limit(1);
    if (!reservation) return;
    if (status !== "APPROVED") {
      await this.releaseReservation(reservation.id, `approval_${status.toLowerCase()}`);
      return;
    }
    const meta = (reservation.metadata ?? {}) as {
      operation: TalentOperation;
      talentType: "voice" | "avatar";
      talentId: string;
      generatedVoiceId: string | null;
    };
    try {
      await this.start(userId, {
        projectId: reservation.projectId,
        operation: meta.operation,
        ...(meta.talentType === "voice" ? { voiceProfileId: meta.talentId } : { avatarProfileId: meta.talentId }),
        ...(meta.generatedVoiceId ? { generatedVoiceId: meta.generatedVoiceId } : {}),
        approvalId,
      });
    } catch (err) {
      // The approval itself stays APPROVED; the user sees the failure via the talent status/event.
      this.log.warn(`talent start after approval ${approvalId} failed: ${err instanceof Error ? err.message : String(err)}`);
      await this.releaseReservation(reservation.id, "start_failed");
    }
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
