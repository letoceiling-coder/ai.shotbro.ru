import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { and, asc, desc, eq, gte, inArray, or, like, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import {
  CanvasQuoteInputSchema,
  SaveCanvasInputSchema,
  SceneCanvasPayloadSchema,
  canConnectCanvasNodes,
  type CanvasNodeRun,
  type CanvasQuoteResult,
  type SceneCanvasPayload,
  type SceneCanvasView,
} from "@shotbro/contracts";
import {
  buildCanvasRunPlan,
  canvasApprovalPayload,
  canvasRunAllNodeIds,
  evaluateBudgetCaps,
  quoteCanvasNode,
  syncCanvasWithStoryboard,
  type CanvasRunStep,
  type CanvasSceneLite,
} from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import {
  approval,
  asset,
  avatarLook,
  avatarProfile,
  budgetReservation,
  conversation,
  costLedgerEntry,
  eventLog,
  productionDocument,
  providerJob,
  voiceProfile,
} from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { ApprovalsService } from "../approvals/approvals.service";
import { MediaQueueService } from "../queue/media-queue.service";
import { StoryboardDocumentService } from "../production/storyboard-document.service";
import { CharacterContinuityService } from "../production/character-continuity.service";

export const CANVAS_APPROVAL_TARGET = "CANVAS_RUN";
const QUOTE_TTL_MS = 30 * 60_000;
const RUNS_PER_NODE = 10;

/** provider_job.operation per node kind (AVATAR_VIDEO is the shared Phase 6 operation name). */
const OPERATION: Record<CanvasRunStep["kind"], string> = {
  first_frame: "CANVAS_FIRST_FRAME",
  scene_video: "CANVAS_SCENE_VIDEO",
  avatar_video: "AVATAR_VIDEO",
  tts: "CANVAS_TTS",
  upscale: "CANVAS_UPSCALE",
  assembly: "CANVAS_ASSEMBLY",
};

type CanvasJobMeta = {
  kind: "canvas";
  canvasRunId: string;
  canvasNodeId: string;
  approvalId: string;
  reservationId: string;
  workspaceId: string;
  ownerId: string;
  order: number;
  chargedUsd: number;
  step: CanvasRunStep & { resolved?: Record<string, unknown> };
  mock: boolean;
  outputMimeType?: string;
  /** Chat that receives the finished MP4 (the conversation of the price card). */
  conversationId?: string;
};

function runStatus(s: string): CanvasNodeRun["status"] {
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "FAILED" || s === "CANCELLED" || s === "TIMED_OUT") return "FAILED";
  if (s === "RUNNING" || s === "SUBMITTING" || s === "SUBMITTED") return "RUNNING";
  return "QUEUED";
}

const quoteKey = (approvalId: string) => `canvas-quote:${approvalId}`;

/**
 * Phase 6E — scene canvas. A view over the storyboard: scene nodes are created from storyboard scenes
 * and read their prompts from it. Running nodes uses the Phase 6C protocol: quote (price card in chat,
 * budget held) → user approves → server creates the jobs → worker executes and settles the budget.
 */
@Injectable()
export class CanvasService implements OnModuleInit {
  private readonly env = loadEnvFromProcess();
  private readonly log = new Logger(CanvasService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(ApprovalsService) private readonly approvals: ApprovalsService,
    @Inject(MediaQueueService) private readonly queue: MediaQueueService,
    @Inject(StoryboardDocumentService) private readonly storyboard: StoryboardDocumentService,
    @Inject(CharacterContinuityService) private readonly characters: CharacterContinuityService,
  ) {}

  onModuleInit() {
    this.approvals.registerTargetHandler(CANVAS_APPROVAL_TARGET, (approvalId, status, userId) =>
      this.onApprovalDecided(approvalId, status, userId),
    );
  }

  // ---------- document ----------

  private async scenes(userId: string, projectId: string) {
    const sb = await this.storyboard.getActive(userId, projectId);
    const scenes: CanvasSceneLite[] = (sb?.payload.scenes ?? []).map((s) => ({
      sceneId: s.sceneId,
      order: s.order,
      title: s.title,
      durationSeconds: s.durationSeconds,
      firstFramePrompt: s.firstFramePrompt,
      description: s.description,
      videoMotionPrompt: s.videoMotionPrompt,
      narration: s.narration,
    }));
    const revisions = new Map((sb?.payload.scenes ?? []).map((s) => [s.sceneId, s.revision]));
    return { scenes, revisions, storyboardVersion: sb?.version ?? null };
  }

  private async canvasRow(projectId: string) {
    const [row] = await this.db
      .select()
      .from(productionDocument)
      .where(
        and(
          eq(productionDocument.projectId, projectId),
          eq(productionDocument.docType, "SCENE_CANVAS"),
          eq(productionDocument.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(productionDocument.updatedAt))
      .limit(1);
    return row ?? null;
  }

  /** Loads the canvas and adds nodes for new storyboard scenes (idempotent). */
  private async loadSynced(userId: string, projectId: string) {
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const { scenes, revisions, storyboardVersion } = await this.scenes(userId, projectId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.canvasRow(projectId);
      const current = row ? SceneCanvasPayloadSchema.parse(row.payload) : null;
      const sync = syncCanvasWithStoryboard(current, scenes);
      if (!row) {
        const id = uuid();
        await this.db.insert(productionDocument).values({
          id,
          projectId,
          docType: "SCENE_CANVAS",
          version: 1,
          status: "ACTIVE",
          schemaVersion: 1,
          payload: sync.payload as unknown as Record<string, unknown>,
          createdBy: userId,
        });
        return { workspaceId, id, version: 1, payload: sync.payload, scenes, revisions, storyboardVersion, orphanSceneIds: sync.orphanSceneIds };
      }
      if (!sync.changed) {
        return { workspaceId, id: row.id, version: row.version, payload: sync.payload, scenes, revisions, storyboardVersion, orphanSceneIds: sync.orphanSceneIds };
      }
      const updated = await this.db
        .update(productionDocument)
        .set({ payload: sync.payload as unknown as Record<string, unknown>, version: row.version + 1, updatedAt: new Date() })
        .where(and(eq(productionDocument.id, row.id), eq(productionDocument.version, row.version)))
        .returning({ id: productionDocument.id });
      if (updated.length) {
        return { workspaceId, id: row.id, version: row.version + 1, payload: sync.payload, scenes, revisions, storyboardVersion, orphanSceneIds: sync.orphanSceneIds };
      }
      // A concurrent save won the race: reload and merge again.
    }
    throw new ConflictException({ code: "canvas_conflict" });
  }

  private async runsByNode(projectId: string): Promise<Record<string, CanvasNodeRun[]>> {
    const rows = await this.db
      .select()
      .from(providerJob)
      .where(and(eq(providerJob.projectId, projectId), sql`${providerJob.metadata}->>'kind' = 'canvas'`))
      .orderBy(desc(providerJob.createdAt))
      .limit(500);
    const out: Record<string, CanvasNodeRun[]> = {};
    for (const r of rows) {
      const meta = (r.metadata ?? {}) as Partial<CanvasJobMeta>;
      const nodeId = meta.canvasNodeId;
      if (!nodeId) continue;
      const list = (out[nodeId] ??= []);
      if (list.length >= RUNS_PER_NODE) continue;
      list.push({
        id: r.id,
        nodeId,
        status: runStatus(r.status),
        assetId: r.outputAssetIds?.[0] ?? null,
        mimeType: meta.outputMimeType ?? null,
        providerId: r.providerId,
        failureCode: r.failureCode,
        approvalId: meta.approvalId ?? null,
        mock: Boolean(meta.mock),
        createdAt: r.createdAt.toISOString(),
      });
    }
    return out;
  }

  async get(userId: string, projectId: string): Promise<SceneCanvasView> {
    const c = await this.loadSynced(userId, projectId);
    return {
      documentId: c.id,
      version: c.version,
      payload: c.payload,
      storyboardVersion: c.storyboardVersion,
      scenes: [...c.scenes]
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          sceneId: s.sceneId,
          order: s.order,
          title: s.title,
          durationSeconds: s.durationSeconds,
          // Same fallback the run plan uses, so the editor shows exactly what will be generated.
          firstFramePrompt: s.firstFramePrompt || s.description || s.title || "",
          videoMotionPrompt: s.videoMotionPrompt,
          narration: s.narration,
          revision: c.revisions.get(s.sceneId) ?? 1,
        })),
      orphanSceneIds: c.orphanSceneIds,
      runs: await this.runsByNode(projectId),
      mock: this.env.AI_MOCK_MODE,
    };
  }

  /** Autosave (positions, edges, user nodes, viewport) with optimistic locking. */
  async save(userId: string, projectId: string, body: unknown) {
    const parsed = SaveCanvasInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_input", issues: parsed.error.issues });
    const input = parsed.data;
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);
    const row = await this.canvasRow(projectId);
    if (!row) throw new NotFoundException({ code: "canvas_not_found" });
    if (row.version !== input.expectedVersion) {
      throw new ConflictException({ code: "canvas_conflict", currentVersion: row.version });
    }
    const ids = new Set<string>();
    for (const n of input.nodes) {
      if (ids.has(n.id)) throw new BadRequestException({ code: "duplicate_node", nodeId: n.id });
      ids.add(n.id);
    }
    const byId = new Map(input.nodes.map((n) => [n.id, n]));
    const edgeIds = new Set<string>();
    for (const e of input.edges) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) throw new BadRequestException({ code: "edge_unknown_node", edgeId: e.id });
      if (!canConnectCanvasNodes(s, t)) throw new BadRequestException({ code: "invalid_connection", edgeId: e.id });
      if (edgeIds.has(e.id)) throw new BadRequestException({ code: "duplicate_edge", edgeId: e.id });
      edgeIds.add(e.id);
    }
    await this.assertNodeRefs(workspaceId, projectId, input.nodes);
    const payload: SceneCanvasPayload = { schemaVersion: 1, nodes: input.nodes, edges: input.edges, viewport: input.viewport };
    const updated = await this.db
      .update(productionDocument)
      .set({ payload: payload as unknown as Record<string, unknown>, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(productionDocument.id, row.id), eq(productionDocument.version, row.version)))
      .returning({ id: productionDocument.id });
    if (!updated.length) throw new ConflictException({ code: "canvas_conflict" });
    return { documentId: row.id, version: row.version + 1 };
  }

  /** Nodes may only point at media and talent of the same workspace (IDOR guard). */
  private async assertNodeRefs(workspaceId: string, projectId: string, nodes: SceneCanvasPayload["nodes"]) {
    const assetIds = [...new Set(nodes.map((n) => n.data?.assetId).filter(Boolean) as string[])];
    if (assetIds.length) {
      const rows = await this.db.select().from(asset).where(inArray(asset.id, assetIds));
      for (const id of assetIds) {
        const a = rows.find((r) => r.id === id);
        if (!a || a.workspaceId !== workspaceId || a.deletedAt) throw new BadRequestException({ code: "asset_not_accessible", assetId: id });
        if (a.projectId && a.projectId !== projectId) throw new BadRequestException({ code: "asset_not_accessible", assetId: id });
      }
    }
    const avatarIds = [...new Set(nodes.map((n) => n.data?.avatarProfileId).filter(Boolean) as string[])];
    if (avatarIds.length) {
      const rows = await this.db.select().from(avatarProfile).where(inArray(avatarProfile.id, avatarIds));
      for (const id of avatarIds) {
        if (!rows.some((r) => r.id === id && r.workspaceId === workspaceId)) throw new BadRequestException({ code: "avatar_not_accessible" });
      }
    }
    const voiceIds = [...new Set(nodes.map((n) => n.data?.voiceProfileId).filter(Boolean) as string[])];
    if (voiceIds.length) {
      const rows = await this.db.select().from(voiceProfile).where(inArray(voiceProfile.id, voiceIds));
      for (const id of voiceIds) {
        if (!rows.some((r) => r.id === id && r.workspaceId === workspaceId)) throw new BadRequestException({ code: "voice_not_accessible" });
      }
    }
  }

  // ---------- run planning ----------

  private latestAssets(runs: Record<string, CanvasNodeRun[]>) {
    const m = new Map<string, string>();
    for (const [nodeId, list] of Object.entries(runs)) {
      const done = list.find((r) => r.status === "COMPLETED" && r.assetId);
      if (done?.assetId) m.set(nodeId, done.assetId);
    }
    return m;
  }

  /**
   * Builds the plan and resolves talent for avatar video / TTS: a character input contributes its
   * assigned avatar, look and voice. Talent must be READY and belong to this workspace.
   */
  async plan(userId: string, projectId: string, nodeIds: string[]) {
    const c = await this.loadSynced(userId, projectId);
    const runs = await this.runsByNode(projectId);
    const active = Object.values(runs)
      .flat()
      .filter((r) => nodeIds.includes(r.nodeId) && (r.status === "QUEUED" || r.status === "RUNNING"));
    if (active.length) throw new ConflictException({ code: "node_busy", nodeId: active[0]!.nodeId });
    const plan = buildCanvasRunPlan({ payload: c.payload, scenes: c.scenes, nodeIds, latestAssetByNode: this.latestAssets(runs) });
    if (!plan.ok) throw new BadRequestException({ code: plan.error.code, nodeId: plan.error.nodeId, message: plan.error.message });
    await this.assertNodeRefs(c.workspaceId, projectId, c.payload.nodes.filter((n) => nodeIds.includes(n.id) || plan.steps.some((s) => s.inputs.some((i) => i.nodeId === n.id))));

    const chars = (await this.characters.list(userId, projectId)).items;
    const steps: Array<CanvasRunStep & { resolved: Record<string, unknown> }> = [];
    for (const step of plan.steps) {
      const resolved: Record<string, unknown> = {};
      if (step.kind === "avatar_video" || step.kind === "tts") {
        let avatarId: string | undefined;
        let lookId: string | undefined;
        let voiceId: string | undefined;
        for (const i of step.inputs) {
          if (i.type === "character") {
            const ch = chars.find((x) => x.id === i.characterId);
            if (!ch) throw new BadRequestException({ code: "character_not_found", nodeId: i.nodeId });
            avatarId ??= ch.avatarProfileId;
            lookId ??= ch.avatarLookId;
            voiceId ??= ch.voiceProfileId;
          }
          if (i.type === "avatar") {
            avatarId = i.avatarProfileId ?? avatarId;
            lookId = i.avatarLookId ?? lookId;
          }
          if (i.type === "voice") voiceId = i.voiceProfileId ?? voiceId;
        }
        if (step.kind === "avatar_video") {
          if (!avatarId) throw new BadRequestException({ code: "missing_avatar", nodeId: step.nodeId });
          const [a] = await this.db.select().from(avatarProfile).where(eq(avatarProfile.id, avatarId)).limit(1);
          if (!a || a.workspaceId !== c.workspaceId || a.archivedAt) throw new BadRequestException({ code: "avatar_not_accessible", nodeId: step.nodeId });
          if (a.status !== "READY") throw new BadRequestException({ code: "avatar_not_ready", nodeId: step.nodeId });
          if (!lookId) {
            const [l] = await this.db.select().from(avatarLook).where(eq(avatarLook.avatarId, a.id)).orderBy(desc(avatarLook.isDefault)).limit(1);
            lookId = l?.id;
          }
          resolved.avatarProfileId = a.id;
          resolved.avatarKind = a.kind;
          resolved.avatarLookId = lookId ?? null;
        }
        if (voiceId) {
          const [v] = await this.db.select().from(voiceProfile).where(eq(voiceProfile.id, voiceId)).limit(1);
          if (!v || v.workspaceId !== c.workspaceId || v.archivedAt) throw new BadRequestException({ code: "voice_not_accessible", nodeId: step.nodeId });
          if (v.status !== "READY") throw new BadRequestException({ code: "voice_not_ready", nodeId: step.nodeId });
          resolved.voiceProfileId = v.id;
        } else if (step.kind === "tts") {
          throw new BadRequestException({ code: "missing_voice", nodeId: step.nodeId });
        }
      }
      if (step.kind === "assembly") {
        // Clip order: storyboard scene order first, then other videos by id.
        const sceneOrder = new Map(c.scenes.map((s) => [s.sceneId, s.order]));
        const nodeScene = new Map(c.payload.nodes.map((n) => [n.id, n.sceneId]));
        const rank = (id: string) => {
          const sid = nodeScene.get(id);
          return sid != null && sceneOrder.has(sid) ? sceneOrder.get(sid)! : Number.MAX_SAFE_INTEGER;
        };
        resolved.videoOrder = step.inputs
          .filter((i) => i.type === "video")
          .map((i) => i.nodeId)
          .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      }
      // Talent identity and clip order are part of what the user approves.
      const specHash = Object.keys(resolved).length
        ? createHash("sha256").update(step.specHash + JSON.stringify(resolved)).digest("hex")
        : step.specHash;
      steps.push({ ...step, specHash, resolved });
    }
    const items = steps.map((s) => {
      const q = quoteCanvasNode(this.env, { kind: s.kind, durationSeconds: s.durationSeconds, textLength: s.text.length });
      return { step: s, quote: q };
    });
    return { canvas: c, steps, items };
  }

  private targetVersion(items: Array<{ step: { nodeId: string; specHash: string } }>) {
    return createHash("sha256")
      .update(items.map((i) => `${i.step.nodeId}:${i.step.specHash}`).join("|"))
      .digest("hex")
      .slice(0, 32);
  }

  /** USD the user committed today across all paid media (talent + canvas). */
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

  // ---------- agent (Phase 6F) ----------

  /** Compact canvas state for the agent: scenes, runnable nodes with their last status, latest MP4. */
  async agentSummary(userId: string, projectId: string) {
    const v = await this.get(userId, projectId);
    const runnable = v.payload.nodes.filter((n) => ["first_frame", "scene_video", "avatar_video", "tts", "upscale", "assembly"].includes(n.kind));
    const delivery = (v.runs["assembly"] ?? []).find((r) => r.status === "COMPLETED" && r.assetId);
    return {
      scenes: v.scenes.map((s) => ({ ordinal: s.order, sceneId: s.sceneId, title: s.title, durationSeconds: s.durationSeconds, prompt: s.firstFramePrompt.slice(0, 300) })),
      nodes: runnable.map((n) => ({ nodeId: n.id, kind: n.kind, sceneId: n.sceneId ?? null, lastStatus: v.runs[n.id]?.[0]?.status ?? "none", versions: (v.runs[n.id] ?? []).filter((r) => r.status === "COMPLETED").length })),
      runAllNodeCount: canvasRunAllNodeIds(v.payload).length,
      latestDeliveryAssetId: delivery?.assetId ?? null,
      orphanSceneIds: v.orphanSceneIds,
      mock: v.mock,
    };
  }

  /** The agent proposes a run; this only creates the priced approval card (same as the UI button). */
  async proposeForAgent(
    userId: string,
    projectId: string,
    input: { conversationId?: string; scope: "all" | "scene"; sceneOrdinal?: number },
  ) {
    const c = await this.loadSynced(userId, projectId);
    let nodeIds: string[];
    if (input.scope === "scene") {
      const scene = [...c.scenes].sort((a, b) => a.order - b.order)[(input.sceneOrdinal ?? 0) - 1];
      if (!scene) throw new BadRequestException({ code: "scene_not_found", message: `Сцены №${input.sceneOrdinal} нет в раскадровке` });
      const sceneNodes = c.payload.nodes.filter((n) => n.sceneId === scene.sceneId && ["first_frame", "scene_video"].includes(n.kind)).map((n) => n.id);
      // Re-do the scene and rebuild the final cut so the chat receives a fresh MP4.
      const all = canvasRunAllNodeIds(c.payload);
      nodeIds = [...sceneNodes, ...all.filter((id) => c.payload.nodes.find((n) => n.id === id)?.kind === "assembly")];
    } else {
      nodeIds = canvasRunAllNodeIds(c.payload);
    }
    if (!nodeIds.length) throw new BadRequestException({ code: "nothing_to_run", message: "На холсте нет узлов, подключённых к «Выдаче»" });
    return this.quote(userId, projectId, { nodeIds, conversationId: input.conversationId });
  }

  // ---------- quote ----------

  async quote(userId: string, projectId: string, body: unknown): Promise<CanvasQuoteResult> {
    const parsed = CanvasQuoteInputSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: "invalid_input", issues: parsed.error.issues });
    const input = parsed.data;
    const { canvas, items } = await this.plan(userId, projectId, input.nodeIds);
    const totalCharged = Math.round(items.reduce((s, i) => s + i.quote.chargedUsd, 0) * 100) / 100;
    const totalLive = Math.round(items.reduce((s, i) => s + i.quote.estimatedLiveUsd, 0) * 100) / 100;

    const caps = evaluateBudgetCaps({
      chargedUsd: totalCharged,
      spentTodayUsd: await this.spentTodayUsd(userId),
      runCapUsd: this.env.MEDIA_RUN_MAX_COST_USD,
      dailyCapUsd: this.env.MEDIA_USER_DAILY_MAX_USD,
    });
    if (!caps.ok) throw new ConflictException({ code: caps.code.toLowerCase(), message: caps.message });

    const conversationId = await this.conversationFor(projectId, input.conversationId);
    const payload = canvasApprovalPayload({
      canvasId: canvas.id,
      items: items.map((i) => ({ nodeId: i.step.nodeId, kind: i.step.kind, specHash: i.step.specHash, chargedUsd: i.quote.chargedUsd })),
    });
    const mock = this.env.AI_MOCK_MODE;
    const n = items.length;
    const title =
      n === 1
        ? `Запустить узел «${labelOf(items[0]!.step.kind)}» — ≈ $${totalLive.toFixed(2)}${mock ? " (тест: $0)" : ""}`
        : `Запустить ${n} узлов холста — ≈ $${totalLive.toFixed(2)}${mock ? " (тест: $0)" : ""}`;
    const created = await this.approvals.create(userId, projectId, {
      conversationId,
      title,
      description: `${items.map((i) => `${labelOf(i.step.kind)}: ≈ $${i.quote.estimatedLiveUsd.toFixed(2)}`).join("; ")}. Списание только после вашего подтверждения.`,
      targetType: CANVAS_APPROVAL_TARGET,
      targetId: canvas.id,
      targetVersion: this.targetVersion(items),
      payload,
    });

    const reservationId = uuid();
    await this.db.insert(budgetReservation).values({
      id: reservationId,
      projectId,
      idempotencyKey: quoteKey(created.approvalId),
      amountUsd: totalCharged,
      status: "HELD",
      reason: "canvas:run",
      createdBy: userId,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
      metadata: { approvalId: created.approvalId, nodeIds: items.map((i) => i.step.nodeId), canvasId: canvas.id, conversationId },
    });
    await this.db.insert(costLedgerEntry).values({
      id: uuid(),
      projectId,
      reservationId,
      entryType: "RESERVE",
      amountUsd: totalCharged,
      source: mock ? "mock" : "canvas",
      mock: mock ? 1 : 0,
      metadata: { approvalId: created.approvalId, estimatedLiveUsd: totalLive },
    });

    return {
      approvalId: created.approvalId,
      messageId: created.messageId,
      payloadHash: created.payloadHash,
      targetVersion: created.targetVersion,
      items: items.map((i) => ({
        nodeId: i.step.nodeId,
        kind: i.step.kind,
        providerId: i.quote.providerId,
        estimatedLiveUsd: i.quote.estimatedLiveUsd,
        chargedUsd: i.quote.chargedUsd,
        note: i.quote.note,
      })),
      totalEstimatedLiveUsd: totalLive,
      totalChargedUsd: totalCharged,
      mock,
    };
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
      source: this.env.AI_MOCK_MODE ? "mock" : "canvas",
      mock: this.env.AI_MOCK_MODE ? 1 : 0,
      metadata: { reason },
    });
  }

  // ---------- start (only from an approved quote) ----------

  /** Called by ApprovalsService when the user decides on a CANVAS_RUN card. */
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
    await this.start(userId, approvalId);
  }

  async start(userId: string, approvalId: string) {
    const [appr] = await this.db.select().from(approval).where(eq(approval.id, approvalId)).limit(1);
    if (!appr || appr.targetType !== CANVAS_APPROVAL_TARGET || appr.status !== "APPROVED") {
      throw new ConflictException({ code: "approval_required" });
    }
    const projectId = appr.projectId;
    const { workspaceId } = await this.access.assertProjectAccess(this.db, userId, projectId);

    const idemPrefix = `canvas-approval:${appr.id}:`;
    const [dup] = await this.db.select().from(providerJob).where(like(providerJob.idempotencyKey, `${idemPrefix}%`)).limit(1);
    if (dup) return { runId: (dup.metadata as CanvasJobMeta).canvasRunId, duplicate: true };

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
    const resMeta = (reservation.metadata ?? {}) as { nodeIds?: string[]; conversationId?: string };
    const nodeIds = resMeta.nodeIds ?? [];

    let planned: Awaited<ReturnType<CanvasService["plan"]>>;
    try {
      planned = await this.plan(userId, projectId, nodeIds);
    } catch (e) {
      await this.releaseReservation(reservation.id, "approval_mismatch");
      throw new ConflictException({ code: "approval_mismatch", reason: errorCode(e) });
    }
    const expectedHash = this.approvals.hashPayload(
      canvasApprovalPayload({
        canvasId: planned.canvas.id,
        items: planned.items.map((i) => ({ nodeId: i.step.nodeId, kind: i.step.kind, specHash: i.step.specHash, chargedUsd: i.quote.chargedUsd })),
      }),
    );
    if (appr.payloadHash !== expectedHash || appr.targetVersion !== this.targetVersion(planned.items)) {
      // Prompt, inputs, talent or price changed after the user saw the price → ask again.
      await this.releaseReservation(reservation.id, "approval_mismatch");
      throw new ConflictException({ code: "approval_mismatch" });
    }

    const mock = this.env.AI_MOCK_MODE;
    if (!mock) {
      // Live generation adapters for canvas nodes land with the Phase 6G live tests.
      await this.releaseReservation(reservation.id, "live_blocked");
      throw new ConflictException({ code: "live_blocked", reasons: ["live canvas generation is not enabled yet (Phase 6G)"] });
    }

    const runId = uuid();
    for (const [order, item] of planned.items.entries()) {
      const meta: CanvasJobMeta = {
        kind: "canvas",
        canvasRunId: runId,
        canvasNodeId: item.step.nodeId,
        approvalId: appr.id,
        reservationId: reservation.id,
        workspaceId,
        ownerId: userId,
        order,
        chargedUsd: item.quote.chargedUsd,
        step: item.step,
        mock,
        conversationId: resMeta.conversationId,
      };
      await this.db.insert(providerJob).values({
        id: uuid(),
        projectId,
        sceneId: item.step.sceneId,
        graphNodeId: item.step.nodeId,
        providerId: item.quote.providerId,
        modelId: item.step.kind,
        operation: OPERATION[item.step.kind],
        status: "QUEUED",
        idempotencyKey: `${idemPrefix}${item.step.nodeId}`,
        inputHash: item.step.specHash,
        estimatedCost: String(item.quote.chargedUsd),
        metadata: meta as unknown as Record<string, unknown>,
      });
    }
    await this.db.insert(eventLog).values({
      id: uuid(),
      workspaceId,
      projectId,
      resourceId: planned.canvas.id,
      type: "canvas.updated",
      payload: { canvasRunId: runId, status: "QUEUED", nodeIds },
    });
    await this.queue.enqueueCanvasRun(runId);
    return { runId, duplicate: false };
  }
}

function errorCode(e: unknown) {
  const r = (e as { getResponse?: () => unknown })?.getResponse?.();
  return (r as { code?: string } | undefined)?.code ?? "invalid";
}

const LABELS: Record<string, string> = {
  first_frame: "Первый кадр",
  scene_video: "Видео сцены",
  avatar_video: "Видео с аватаром",
  tts: "Озвучка",
  upscale: "Апскейл",
  assembly: "Монтаж",
};
function labelOf(kind: string) {
  return LABELS[kind] ?? kind;
}
