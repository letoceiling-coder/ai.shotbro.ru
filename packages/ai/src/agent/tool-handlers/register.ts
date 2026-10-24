import { z } from "zod";
import {
  ProductionBriefSchema,
  ProductionPlanSchema,
  ScriptDocumentSchema,
  StoryboardDocumentSchema,
} from "../../../../contracts/src/production/schemas.js";
import { BriefBuilder, CreativeDirector, ProductionPlanner, Screenwriter, StoryboardDirector } from "../../creative/pipeline.js";
import { estimateMockProductionCost } from "../../cost/cost-engine.js";
import { routeModel } from "../../model-router.js";
import type { ToolExecutor } from "../../tool-executor.js";
import { getPhase4Tool } from "../phase4-tool-catalog.js";

const briefInput = ProductionBriefSchema.partial().extend({
  trigger: z.string().optional(),
});

const triggerInput = z.object({ trigger: z.string().min(1) });

export function registerPhase4ToolHandlers(executor: ToolExecutor) {
  executor.register("get_project_context", z.object({}).strict(), async (_in, ctx) => {
    const run = await ctx.storage.getRun(ctx.runId);
    const brief = await ctx.storage.getActiveDocument(ctx.projectId, "BRIEF");
    return {
      projectId: ctx.projectId,
      runId: ctx.runId,
      productionState: run?.productionState,
      briefVersion: brief?.version,
      mock: true,
    };
  });

  executor.register("get_project_memory", z.object({}).strict(), async (_in, ctx) => {
    const meta = (await ctx.storage.getRun(ctx.runId))?.metadata ?? {};
    return { memory: meta, mock: true };
  });

  executor.register("update_project_brief", briefInput, async (input, ctx) => {
    const trigger = (input.trigger as string | undefined) ?? "user request";
    const built = BriefBuilder.fromUserRequest(trigger);
    const payload = ProductionBriefSchema.parse({ ...built, ...input, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "BRIEF",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, mock: true };
  });

  executor.register("create_production_plan", triggerInput, async (input, ctx) => {
    const trigger = input.trigger as string;
    const briefDoc = await ctx.storage.getActiveDocument(ctx.projectId, "BRIEF");
    const brief = ProductionBriefSchema.parse(briefDoc?.payload ?? BriefBuilder.fromUserRequest(trigger));
    CreativeDirector.concept(brief);
    const plan = ProductionPlanner.plan(brief);
    const payload = ProductionPlanSchema.parse({ ...plan, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "PRODUCTION_PLAN",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, mock: true };
  });

  executor.register("update_production_plan", ProductionPlanSchema.partial(), async (input, ctx) => {
    const existing = await ctx.storage.getActiveDocument(ctx.projectId, "PRODUCTION_PLAN");
    const payload = ProductionPlanSchema.parse({ ...(existing?.payload ?? {}), ...input, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "PRODUCTION_PLAN",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, mock: true };
  });

  executor.register("create_script", triggerInput, async (input, ctx) => {
    const trigger = input.trigger as string;
    const briefDoc = await ctx.storage.getActiveDocument(ctx.projectId, "BRIEF");
    const planDoc = await ctx.storage.getActiveDocument(ctx.projectId, "PRODUCTION_PLAN");
    const brief = ProductionBriefSchema.parse(briefDoc?.payload ?? BriefBuilder.fromUserRequest(trigger));
    const plan = ProductionPlanSchema.parse(planDoc?.payload ?? ProductionPlanner.plan(brief));
    const script = Screenwriter.script(brief, plan);
    const payload = ScriptDocumentSchema.parse({ ...script, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "SCRIPT",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, sceneCount: payload.scenes.length, mock: true };
  });

  executor.register("update_script", ScriptDocumentSchema.partial(), async (input, ctx) => {
    const existing = await ctx.storage.getActiveDocument(ctx.projectId, "SCRIPT");
    const payload = ScriptDocumentSchema.parse({ ...(existing?.payload ?? {}), ...input, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "SCRIPT",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, mock: true };
  });

  executor.register("create_storyboard", triggerInput, async (input, ctx) => {
    const trigger = input.trigger as string;
    let scriptDoc = await ctx.storage.getActiveDocument(ctx.projectId, "SCRIPT");
    if (!scriptDoc) {
      const briefDoc = await ctx.storage.getActiveDocument(ctx.projectId, "BRIEF");
      const brief = ProductionBriefSchema.parse(briefDoc?.payload ?? BriefBuilder.fromUserRequest(trigger));
      const plan = ProductionPlanner.plan(brief);
      const script = Screenwriter.script(brief, plan);
      scriptDoc = await ctx.storage.saveDocument({
        projectId: ctx.projectId,
        docType: "SCRIPT",
        payload: ScriptDocumentSchema.parse({ ...script, mock: true }),
        userId: ctx.userId,
        supersedePrevious: true,
      });
    }
    const script = ScriptDocumentSchema.parse(scriptDoc.payload);
    const board = StoryboardDirector.storyboard(script);
    const payload = StoryboardDocumentSchema.parse({ ...board, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "STORYBOARD",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, frameCount: payload.frames.length, mock: true };
  });

  executor.register("update_storyboard", StoryboardDocumentSchema.partial(), async (input, ctx) => {
    const existing = await ctx.storage.getActiveDocument(ctx.projectId, "STORYBOARD");
    const payload = StoryboardDocumentSchema.parse({ ...(existing?.payload ?? {}), ...input, mock: true });
    const doc = await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "STORYBOARD",
      payload,
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { documentId: doc.id, version: doc.version, mock: true };
  });

  executor.register("prepare_image_prompt", z.object({ sceneId: z.string().optional() }), async (input, ctx) => {
    const storyboard = await ctx.storage.getActiveDocument(ctx.projectId, "STORYBOARD");
    const frames = (storyboard?.payload?.frames as Array<{ sceneId: string; firstFramePrompt: string }>) ?? [];
    const frame = frames.find((f) => f.sceneId === input.sceneId) ?? frames[0];
    return { prompt: frame?.firstFramePrompt ?? "Mock first-frame prompt", mock: true };
  });

  executor.register("prepare_video_prompt", z.object({ sceneId: z.string().optional() }), async (input, ctx) => {
    const storyboard = await ctx.storage.getActiveDocument(ctx.projectId, "STORYBOARD");
    const frames = (storyboard?.payload?.frames as Array<{ sceneId: string; videoMotionPrompt?: string }>) ?? [];
    const frame = frames.find((f) => f.sceneId === input.sceneId) ?? frames[0];
    return { prompt: frame?.videoMotionPrompt ?? "Mock video motion prompt", mock: true };
  });

  executor.register("prepare_voiceover", z.object({ sceneId: z.string().optional() }), async (_in, ctx) => {
    const script = await ctx.storage.getActiveDocument(ctx.projectId, "SCRIPT");
    return { text: "Mock voiceover segment", scriptTitle: script?.payload?.title, mock: true };
  });

  executor.register("estimate_cost", z.object({ strategy: z.enum(["economy", "balance", "quality", "manual"]).optional() }), async (input, ctx) => {
    const parsed = z.object({ strategy: z.enum(["economy", "balance", "quality", "manual"]).optional() }).parse(input);
    const script = await ctx.storage.getActiveDocument(ctx.projectId, "SCRIPT");
    const scenes = (script?.payload?.scenes as unknown[])?.length ?? 3;
    const estimate = estimateMockProductionCost({
      sceneCount: scenes,
      durationSeconds: 15,
      strategy: parsed.strategy ?? "balance",
    });
    await ctx.storage.saveDocument({
      projectId: ctx.projectId,
      docType: "COST_ESTIMATE",
      payload: { ...estimate, mock: true },
      userId: ctx.userId,
      supersedePrevious: true,
    });
    return { ...estimate, mock: true };
  });

  executor.register("compare_models", z.object({ task: z.enum(["text", "image", "video", "audio"]).default("video") }), async (input) => {
    const parsed = z.object({ task: z.enum(["text", "image", "video", "audio"]).default("video") }).parse(input);
    const economy = routeModel(parsed.task, "economy");
    const quality = routeModel(parsed.task, "quality");
    return {
      candidates: [economy, quality],
      recommendation: economy,
      mock: true,
    };
  });

  executor.register("get_production_status", z.object({}).strict(), async (_in, ctx) => {
    const run = await ctx.storage.getRun(ctx.runId);
    if (!run) throw new Error("Run not found");
    return { productionState: run.productionState, status: run.status, mock: true };
  });

  executor.register("get_approval_status", z.object({ targetType: z.string().optional() }), async (_in, ctx) => {
    const run = await ctx.storage.getRun(ctx.runId);
    return { pending: Boolean(run?.productionState?.includes("WAITING")), productionState: run?.productionState, mock: true };
  });

  executor.register("pause_production", z.object({}).strict(), async (_in, ctx) => {
    await ctx.storage.updateRunState(ctx.runId, { productionState: "PAUSED", status: "RUNNING" });
    return { paused: true, mock: true };
  });

  executor.register("cancel_production", z.object({}).strict(), async (_in, ctx) => {
    await ctx.storage.updateRunState(ctx.runId, { productionState: "CANCELLED", status: "CANCELLED" });
    return { cancelled: true, mock: true };
  });

  executor.register("list_project_assets", z.object({}).strict(), async () => ({ items: [], mock: true }));

  executor.register("save_character", z.object({ name: z.string(), description: z.string().optional() }), async (input, ctx) => {
    const run = await ctx.storage.getRun(ctx.runId);
    const metadata = { ...(run?.metadata ?? {}), character: input };
    await ctx.storage.updateRunState(ctx.runId, { metadata });
    return { saved: true, mock: true };
  });

  executor.register("get_character", z.object({}).strict(), async (_in, ctx) => {
    const run = await ctx.storage.getRun(ctx.runId);
    return { character: (run?.metadata as { character?: unknown })?.character ?? null, mock: true };
  });

  executor.register("prepare_timeline", z.object({}).strict(), async (_in, ctx) => {
    const script = await ctx.storage.getActiveDocument(ctx.projectId, "SCRIPT");
    return { scenes: script?.payload?.scenes ?? [], mock: true };
  });

  executor.register("validate_media", z.object({ assetId: z.string().optional() }), async (input) => ({
    valid: true,
    assetId: input.assetId ?? "mock-asset",
    mock: true,
  }));

  executor.register("prepare_delivery", z.object({}).strict(), async () => ({
    format: "mp4",
    label: "MOCK RESULT",
    mock: true,
  }));

  for (const id of ["request_approval", "create_production_graph", "compose_video", "generate.image", "generate.video", "generate.voice", "attach_reference"]) {
    const tool = getPhase4Tool(id);
    if (tool?.implementationStatus === "ADAPTER_PENDING" || tool?.implementationStatus === "ORCHESTRATOR_DELEGATE") {
      executor.register(id, z.object({}).passthrough(), async () => {
        throw new Error(`${id}: ${tool.implementationStatus} — use ProductionOrchestrator/worker path`);
      });
    }
  }
}
