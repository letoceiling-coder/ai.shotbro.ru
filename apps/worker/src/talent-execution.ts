import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Logger } from "pino";
import { createTalentAdapters, FetchHttpTransport } from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { createS3Client } from "@shotbro/config/s3";
import {
  approval,
  asset,
  avatarLook,
  avatarProfile,
  budgetReservation,
  costLedgerEntry,
  eventLog,
  providerJob,
  voiceProfile,
} from "@shotbro/db/schema";
import { getWorkerDb } from "./db.js";
import { ensureMockFixtures, readFixture } from "./mock-fixtures.js";

export const TALENT_EXECUTE_QUEUE = "talent.execute";

/** Mirrors TalentOperationSchema in @shotbro/contracts (worker NodeNext cannot resolve its barrel). */
type TalentOperation = "VOICE_CLONE" | "VOICE_DESIGN" | "VOICE_SAVE" | "AVATAR_TRAIN";

type JobMeta = {
  talentType: "voice" | "avatar";
  talentId: string;
  workspaceId: string;
  ownerId: string;
  generatedVoiceId?: string;
  approvalId?: string;
  reservationId?: string;
};

class TalentJobError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const POLL_INTERVAL_MS = 15_000;
const POLL_MAX_MS = 30 * 60_000;

function s3() {
  return {
    client: createS3Client({
      S3_ENDPOINT: process.env.S3_ENDPOINT!,
      S3_REGION: process.env.S3_REGION!,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
      S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE === "true",
    }),
    bucket: process.env.S3_BUCKET!,
  };
}

async function readAssets(ids: string[], workspaceId: string) {
  const db = getWorkerDb();
  if (!ids.length) return [];
  const rows = await db.select().from(asset).where(inArray(asset.id, ids));
  const { client, bucket } = s3();
  const out: Array<{ id: string; filename: string; contentType: string; data: Buffer }> = [];
  for (const id of ids) {
    const row = rows.find((r) => r.id === id);
    // Re-check tenancy in the worker: never send another workspace's media to a provider.
    if (!row || row.workspaceId !== workspaceId || row.status !== "READY" || row.deletedAt) {
      throw new TalentJobError("ASSET_NOT_ACCESSIBLE", `asset ${id} not usable`);
    }
    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: row.storageKey }));
    if (!got.Body) throw new TalentJobError("ASSET_MISSING", `asset ${id} has no body`);
    out.push({ id, filename: row.originalName, contentType: row.mimeType, data: Buffer.from(await got.Body.transformToByteArray()) });
  }
  return out;
}

async function storeAsset(input: {
  workspaceId: string;
  projectId: string;
  ownerId: string;
  body: Buffer;
  mimeType: string;
  name: string;
  category: string;
}) {
  const { client, bucket } = s3();
  const id = randomUUID();
  const ext = input.mimeType === "audio/mpeg" ? "mp3" : (input.mimeType.split("/")[1] ?? "bin");
  const key = `workspaces/${input.workspaceId}/projects/${input.projectId}/assets/${id}/talent/${id}.${ext}`;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: input.body, ContentType: input.mimeType }));
  await getWorkerDb().insert(asset).values({
    id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    ownerId: input.ownerId,
    mimeType: input.mimeType,
    originalName: input.name,
    storageKey: key,
    sizeBytes: input.body.length,
    checksum: createHash("sha256").update(input.body).digest("hex"),
    status: "READY",
    category: input.category,
  });
  return id;
}

async function emit(workspaceId: string, projectId: string, meta: JobMeta, status: string, jobId: string) {
  await getWorkerDb()
    .insert(eventLog)
    .values({
      id: randomUUID(),
      workspaceId,
      projectId,
      resourceId: meta.talentId,
      type: "talent.updated",
      payload: { talentType: meta.talentType, talentId: meta.talentId, status, providerJobId: jobId },
    });
}

async function setJob(jobId: string, patch: Partial<typeof providerJob.$inferInsert>) {
  await getWorkerDb()
    .update(providerJob)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(providerJob.id, jobId));
}

async function setTalent(meta: JobMeta, patch: Record<string, unknown>) {
  const db = getWorkerDb();
  const table = meta.talentType === "voice" ? voiceProfile : avatarProfile;
  await db
    .update(table)
    .set({ ...patch, updatedAt: new Date() } as never)
    .where(eq(table.id, meta.talentId));
}

async function isApproved(approvalId: string | undefined, projectId: string) {
  if (!approvalId) return false;
  const [row] = await getWorkerDb()
    .select()
    .from(approval)
    .where(and(eq(approval.id, approvalId), eq(approval.projectId, projectId)))
    .limit(1);
  return row?.status === "APPROVED" && (!row.expiresAt || row.expiresAt > new Date());
}


/** Close the quote reservation: CAPTURED on success, RELEASED on failure (ledger entry either way). */
async function settleReservation(meta: JobMeta, projectId: string, outcome: "CAPTURED" | "RELEASED", mock: boolean) {
  if (!meta.reservationId) return;
  const db = getWorkerDb();
  const [r] = await db.select().from(budgetReservation).where(eq(budgetReservation.id, meta.reservationId)).limit(1);
  if (!r || r.status !== "HELD") return;
  await db
    .update(budgetReservation)
    .set({ status: outcome, updatedAt: new Date() })
    .where(and(eq(budgetReservation.id, r.id), eq(budgetReservation.status, "HELD")));
  await db.insert(costLedgerEntry).values({
    id: randomUUID(),
    projectId,
    reservationId: r.id,
    entryType: outcome === "CAPTURED" ? "CAPTURE" : "RELEASE",
    amountUsd: r.amountUsd,
    source: mock ? "mock" : "talent",
    mock: mock ? 1 : 0,
    metadata: { approvalId: meta.approvalId },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Executes one talent provider_job end to end. Safe to retry: terminal jobs are skipped. */
export async function executeTalentJob(data: { jobId: string }, log: Logger) {
  const db = getWorkerDb();
  const env = loadEnvFromProcess();
  const [job] = await db.select().from(providerJob).where(eq(providerJob.id, data.jobId)).limit(1);
  if (!job) return { skipped: "missing" };
  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") return { skipped: job.status };

  const meta = (job.metadata ?? {}) as JobMeta;
  const operation = job.operation as TalentOperation;
  const approved = await isApproved(meta.approvalId, job.projectId);
  // Defense in depth (6C): the API only enqueues approved jobs; the worker re-checks in every mode.
  if (!approved) {
    await fail(job.id, job.projectId, meta, "APPROVAL_REQUIRED", "no approved cost confirmation", log);
    return { status: "FAILED", code: "APPROVAL_REQUIRED" };
  }
  const adapters = createTalentAdapters(env, operation, { approved, transport: new FetchHttpTransport() });

  // Never fake success: outside mock mode, a closed live gate fails the job instead of using mocks.
  if (adapters.mock && !env.AI_MOCK_MODE) {
    await fail(job.id, job.projectId, meta, "LIVE_BLOCKED", adapters.reasons.join("; "), log);
    return { status: "FAILED", code: "LIVE_BLOCKED" };
  }

  await setJob(job.id, { status: "SUBMITTING", attemptCount: job.attemptCount + 1, startedAt: new Date() });
  try {
    const result = await run(operation, job, meta, adapters, log);
    await db.insert(costLedgerEntry).values({
      id: randomUUID(),
      projectId: job.projectId,
      entryType: "ACTUAL",
      amountUsd: 0,
      source: adapters.mock ? `mock:${job.providerId}` : job.providerId,
      mock: adapters.mock ? 1 : 0,
      metadata: { providerJobId: job.id, operation, talentId: meta.talentId, usage: result.usage ?? {} },
    });
    await setJob(job.id, { status: "COMPLETED", completedAt: new Date(), actualUsage: result.usage ?? {}, outputAssetIds: result.assetIds });
    await settleReservation(meta, job.projectId, "CAPTURED", adapters.mock);
    await emit(meta.workspaceId, job.projectId, meta, "COMPLETED", job.id);
    log.info({ jobId: job.id, operation, mock: adapters.mock }, "talent job completed");
    return { status: "COMPLETED" };
  } catch (err) {
    const code = err instanceof TalentJobError ? err.code : ((err as { code?: string })?.code ?? "TALENT_JOB_FAILED");
    const message = err instanceof Error ? err.message : ((err as { message?: string })?.message ?? "failed");
    await fail(job.id, job.projectId, meta, code, message, log);
    return { status: "FAILED", code };
  }
}

async function fail(jobId: string, projectId: string, meta: JobMeta, code: string, message: string, log: Logger) {
  await setJob(jobId, { status: "FAILED", failedAt: new Date(), failureCode: code });
  await settleReservation(meta, projectId, "RELEASED", loadEnvFromProcess().AI_MOCK_MODE);
  const db = getWorkerDb();
  const table = meta.talentType === "voice" ? voiceProfile : avatarProfile;
  const [row] = await db.select({ metadata: table.metadata }).from(table).where(eq(table.id, meta.talentId)).limit(1);
  await setTalent(meta, { status: "FAILED", metadata: { ...(row?.metadata ?? {}), lastError: `${code}: ${message}`.slice(0, 500) } });
  await emit(meta.workspaceId, projectId, meta, "FAILED", jobId);
  log.warn({ jobId, code }, "talent job failed");
}

type RunResult = { usage?: Record<string, unknown>; assetIds: string[] };

async function run(
  operation: TalentOperation,
  job: typeof providerJob.$inferSelect,
  meta: JobMeta,
  adapters: ReturnType<typeof createTalentAdapters>,
  log: Logger,
): Promise<RunResult> {
  const db = getWorkerDb();
  const ctx = { idempotencyKey: job.idempotencyKey ?? job.id };

  if (operation === "VOICE_CLONE" || operation === "VOICE_DESIGN" || operation === "VOICE_SAVE") {
    const [voice] = await db.select().from(voiceProfile).where(eq(voiceProfile.id, meta.talentId)).limit(1);
    if (!voice || voice.workspaceId !== meta.workspaceId) throw new TalentJobError("TALENT_NOT_FOUND", "voice not found");
    const priorMeta = (voice.metadata ?? {}) as Record<string, unknown>;

    if (operation === "VOICE_CLONE") {
      if (!voice.consentAssetId || !voice.consentConfirmedAt) throw new TalentJobError("CONSENT_REQUIRED", "consent missing");
      const files = await readAssets(voice.sampleAssetIds ?? [], meta.workspaceId);
      await setJob(job.id, { status: "RUNNING", submittedAt: new Date() });
      const r = await adapters.voice.submit("ivc", "VOICE_CLONE", {
        name: voice.name,
        description: voice.description ?? undefined,
        labels: voice.labels ?? {},
        removeBackgroundNoise: Boolean(priorMeta.removeBackgroundNoise),
        files: files.map((f) => ({ filename: f.filename, contentType: f.contentType, data: f.data })),
        consentVerified: true,
      }, ctx);
      const voiceId = r.outputs?.[0]?.externalId;
      if (!voiceId) throw new TalentJobError("PROVIDER_BAD_RESPONSE", "no voice id");
      await setTalent(meta, { providerVoiceId: voiceId, status: "READY", metadata: { ...priorMeta, lastError: null, usage: r.usage } });
      return { usage: r.usage, assetIds: [] };
    }

    if (operation === "VOICE_DESIGN") {
      if (!voice.designPrompt) throw new TalentJobError("INVALID_TALENT", "design prompt missing");
      await setJob(job.id, { status: "RUNNING", submittedAt: new Date() });
      const r = await adapters.voice.submit("eleven_multilingual_ttv_v2", "VOICE_DESIGN", { voiceDescription: voice.designPrompt }, ctx);
      const mockAudio = adapters.mock ? await mockAudioFixture(log) : null;
      const previews = [];
      const assetIds: string[] = [];
      for (const [i, p] of (r.outputs ?? []).entries()) {
        const body = p.base64 ? Buffer.from(p.base64, "base64") : mockAudio;
        const assetId = body
          ? await storeAsset({
              workspaceId: meta.workspaceId,
              projectId: job.projectId,
              ownerId: meta.ownerId,
              body,
              mimeType: p.mimeType ?? "audio/mpeg",
              name: `${voice.name} — вариант ${i + 1}.mp3`,
              category: adapters.mock ? "mock_voice_preview" : "voice_preview",
            })
          : null;
        if (assetId) assetIds.push(assetId);
        previews.push({ generatedVoiceId: p.externalId!, label: p.label ?? `Вариант ${i + 1}`, assetId, durationSecs: p.durationSecs });
      }
      // Previews ready: the user now picks one (VOICE_SAVE). Voice stays DRAFT until saved.
      await setTalent(meta, { status: "DRAFT", metadata: { ...priorMeta, previews, lastError: null } });
      return { usage: r.usage, assetIds };
    }

    const previews = (priorMeta.previews ?? []) as Array<{ generatedVoiceId: string; assetId: string | null }>;
    const chosen = previews.find((p) => p.generatedVoiceId === meta.generatedVoiceId);
    if (!chosen) throw new TalentJobError("PREVIEW_NOT_FOUND", "preview not found");
    await setJob(job.id, { status: "RUNNING", submittedAt: new Date() });
    const r = await adapters.voice.submit("eleven_multilingual_ttv_v2", "VOICE_SAVE", {
      voiceName: voice.name,
      voiceDescription: voice.designPrompt ?? voice.name,
      generatedVoiceId: chosen.generatedVoiceId,
    }, ctx);
    const voiceId = r.outputs?.[0]?.externalId;
    if (!voiceId) throw new TalentJobError("PROVIDER_BAD_RESPONSE", "no voice id");
    await setTalent(meta, {
      providerVoiceId: voiceId,
      previewAssetId: chosen.assetId,
      status: "READY",
      metadata: { ...priorMeta, lastError: null },
    });
    return { usage: r.usage, assetIds: [] };
  }

  // AVATAR_TRAIN (HeyGen photo avatar)
  const [avatar] = await db.select().from(avatarProfile).where(eq(avatarProfile.id, meta.talentId)).limit(1);
  if (!avatar || avatar.workspaceId !== meta.workspaceId) throw new TalentJobError("TALENT_NOT_FOUND", "avatar not found");
  if (!avatar.consentAssetId || !avatar.consentConfirmedAt) throw new TalentJobError("CONSENT_REQUIRED", "consent missing");
  const photos = await readAssets(avatar.sourceAssetIds ?? [], meta.workspaceId);
  const imageKeys: string[] = [];
  for (const p of photos) imageKeys.push(await adapters.avatar.uploadPhoto(p.data, p.contentType));
  const sub = await adapters.avatar.submit("heygen-photo-avatar", "AVATAR_TRAIN", { name: avatar.name, imageKeys }, ctx);
  await setJob(job.id, { status: "RUNNING", submittedAt: new Date(), providerJobId: sub.providerJobId ?? null });
  const groupId = sub.providerJobId?.split(":")[1] ?? null;
  await setTalent(meta, { providerGroupId: groupId, status: "CREATING" });

  const started = Date.now();
  let status = await adapters.avatar.getStatus(sub.providerJobId!);
  while (status.status !== "COMPLETED" && status.status !== "FAILED") {
    if (Date.now() - started > POLL_MAX_MS) throw new TalentJobError("TIMED_OUT", "avatar training timed out");
    await sleep(POLL_INTERVAL_MS);
    status = await adapters.avatar.getStatus(sub.providerJobId!);
  }
  if (status.status === "FAILED") throw new TalentJobError("PROVIDER_FAILED", "avatar training failed");

  const outputs: Array<{ externalId?: string; label?: string }> =
    ("outputs" in status ? (status.outputs as Array<{ externalId?: string; label?: string }> | undefined) : undefined) ?? [];
  await db.delete(avatarLook).where(eq(avatarLook.avatarId, avatar.id));
  for (const [i, o] of outputs.entries()) {
    await db.insert(avatarLook).values({
      id: randomUUID(),
      avatarId: avatar.id,
      providerLookId: o.externalId ?? null,
      label: o.label ?? `Образ ${i + 1}`,
      // Live look images are fetched into MinIO in 6D; until then preview = first source photo.
      previewAssetId: avatar.sourceAssetIds?.[i] ?? avatar.sourceAssetIds?.[0] ?? null,
      isDefault: i === 0,
    });
  }
  await setTalent(meta, { status: "READY", metadata: { ...(avatar.metadata ?? {}), lastError: null, looks: outputs.length } });
  return { usage: { photos: photos.length, looks: outputs.length }, assetIds: [] };
}

async function mockAudioFixture(log: Logger) {
  await ensureMockFixtures(log);
  return readFixture("voice.mp3");
}
