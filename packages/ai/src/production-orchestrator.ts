import type { AgentProductionState } from "@shotbro/contracts";
import type { AppEnv } from "@shotbro/config/env";
import { assertProductionTransition } from "./state-machine.js";
import type { ProductionStoragePort } from "./ports/production-storage.js";
import { BriefBuilder, CreativeDirector, ProductionPlanner, Screenwriter, StoryboardDirector } from "./creative/pipeline.js";
import { estimateMockProductionCost } from "./cost/cost-engine.js";
import { planProductionGraph } from "./graph/graph-planner.js";

export type ApprovalPort = {
  request(input: {
    projectId: string;
    conversationId: string;
    userId: string;
    targetType: string;
    targetId: string;
    targetVersion: string;
    payload: Record<string, unknown>;
    title: string;
    description?: string;
  }): Promise<void>;

  isApproved(projectId: string, targetType: string, targetId: string, targetVersion: string): Promise<boolean>;
};

export type OrchestratorPorts = {
  storage: ProductionStoragePort;
  approvals: ApprovalPort;
  onChatBlocks?: (blocks: Record<string, unknown>[]) => Promise<void>;
};

const WAITING: AgentProductionState[] = [
  "WAITING_PLAN_APPROVAL",
  "WAITING_SCRIPT_APPROVAL",
  "WAITING_STORYBOARD_APPROVAL",
  "WAITING_COST_APPROVAL",
];

export class ProductionOrchestrator {
  constructor(private readonly env: AppEnv) {}

  async advance(runId: string, userId: string, ports: OrchestratorPorts): Promise<AgentProductionState> {
    const run = await ports.storage.getRun(runId);
    if (!run) throw new Error("Run not found");
    if (run.status === "CANCELLED" || run.productionState === "PAUSED") return run.productionState;
    if (WAITING.includes(run.productionState)) {
      const ok = await this.checkWaitingApproval(run, ports);
      if (!ok) return run.productionState;
    }

    let state: AgentProductionState = run.productionState;
    const trigger = run.triggerMessage ?? "";

    while (true) {
      const next = this.nextState(state);
      if (!next || next === state) break;
      assertProductionTransition(state, next);
      state = next;
      await ports.storage.updateRunState(runId, { productionState: state, status: "RUNNING" });
      await ports.storage.emitEvent("agent.run.updated", { runId, productionState: state });

      await this.executeState(state, run, userId, ports, trigger);

      if (WAITING.includes(state)) break;
      if (state === "READY_FOR_PRODUCTION" || state === "COMPLETED") break;
    }

    if (state === "COMPLETED") {
      await ports.storage.updateRunState(runId, { status: "COMPLETED", productionState: state });
      await ports.storage.emitEvent("agent.run.completed", { runId, productionState: state });
    } else if (WAITING.includes(state)) {
      await ports.storage.updateRunState(runId, { status: "RUNNING", productionState: state });
    }

    return state;
  }

  private nextState(current: AgentProductionState): AgentProductionState | null {
    const order: AgentProductionState[] = [
      "DRAFT",
      "BRIEFING",
      "PLANNING",
      "WAITING_PLAN_APPROVAL",
      "SCRIPTING",
      "WAITING_SCRIPT_APPROVAL",
      "STORYBOARDING",
      "WAITING_STORYBOARD_APPROVAL",
      "READY_FOR_PRODUCTION",
      "WAITING_COST_APPROVAL",
      "QUEUED",
      "PRODUCING",
      "QUALITY_CHECK",
      "READY_FOR_DELIVERY",
      "COMPLETED",
    ];
    const idx = order.indexOf(current);
    if (idx < 0 || idx >= order.length - 1) return null;
    return order[idx + 1] ?? null;
  }

  private async checkWaitingApproval(
    run: NonNullable<Awaited<ReturnType<ProductionStoragePort["getRun"]>>>,
    ports: OrchestratorPorts,
  ): Promise<boolean> {
    const map: Partial<Record<AgentProductionState, string>> = {
      WAITING_PLAN_APPROVAL: "PLAN",
      WAITING_SCRIPT_APPROVAL: "SCRIPT",
      WAITING_STORYBOARD_APPROVAL: "STORYBOARD",
      WAITING_COST_APPROVAL: "COST",
    };
    const targetType = map[run.productionState];
    if (!targetType) return false;
    const docType =
      targetType === "PLAN"
        ? "PRODUCTION_PLAN"
        : targetType === "SCRIPT"
          ? "SCRIPT"
          : targetType === "STORYBOARD"
            ? "STORYBOARD"
            : "COST_ESTIMATE";
    const doc = await ports.storage.getActiveDocument(run.projectId, docType);
    if (!doc) return false;
    return ports.approvals.isApproved(run.projectId, targetType, doc.id, String(doc.version));
  }

  private async executeState(
    state: AgentProductionState,
    run: NonNullable<Awaited<ReturnType<ProductionStoragePort["getRun"]>>>,
    userId: string,
    ports: OrchestratorPorts,
    trigger: string,
  ) {
    switch (state) {
      case "BRIEFING": {
        const brief = BriefBuilder.fromUserRequest(trigger);
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "BRIEF",
          payload: brief as unknown as Record<string, unknown>,
          userId,
        });
        const concept = CreativeDirector.concept(brief);
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "CREATIVE_CONCEPT",
          payload: concept as unknown as Record<string, unknown>,
          userId,
        });
        break;
      }
      case "PLANNING": {
        const briefDoc = await ports.storage.getActiveDocument(run.projectId, "BRIEF");
        const brief = (briefDoc?.payload ?? {}) as ReturnType<typeof BriefBuilder.fromUserRequest>;
        const plan = ProductionPlanner.plan(brief);
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "PRODUCTION_PLAN",
          payload: plan as unknown as Record<string, unknown>,
          userId,
        });
        break;
      }
      case "WAITING_PLAN_APPROVAL":
        await this.requestApproval(run, ports, userId, "PLAN", "PRODUCTION_PLAN", "Утвердите план производства");
        await ports.onChatBlocks?.([
          {
            type: "generation_plan",
            demo: true,
            title: "План производства (mock)",
            overallStatus: "completed",
            steps: [
              { id: "brief", label: "Brief", status: "completed" },
              { id: "plan", label: "Plan", status: "pending" },
            ],
          },
        ]);
        break;
      case "SCRIPTING": {
        const briefDoc = await ports.storage.getActiveDocument(run.projectId, "BRIEF");
        const planDoc = await ports.storage.getActiveDocument(run.projectId, "PRODUCTION_PLAN");
        const brief = briefDoc?.payload as ReturnType<typeof BriefBuilder.fromUserRequest>;
        const plan = planDoc?.payload as ReturnType<typeof ProductionPlanner.plan>;
        const script = Screenwriter.script(brief, plan);
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "SCRIPT",
          payload: script as unknown as Record<string, unknown>,
          userId,
        });
        break;
      }
      case "WAITING_SCRIPT_APPROVAL":
        await this.requestApproval(run, ports, userId, "SCRIPT", "SCRIPT", "Утвердите сценарий");
        break;
      case "STORYBOARDING": {
        const scriptDoc = await ports.storage.getActiveDocument(run.projectId, "SCRIPT");
        const script = scriptDoc?.payload as Parameters<typeof StoryboardDirector.storyboard>[0];
        const storyboard = StoryboardDirector.storyboard(script);
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "STORYBOARD",
          payload: storyboard as unknown as Record<string, unknown>,
          userId,
        });
        break;
      }
      case "WAITING_STORYBOARD_APPROVAL":
        await this.requestApproval(run, ports, userId, "STORYBOARD", "STORYBOARD", "Утвердите раскадровку");
        break;
      case "WAITING_COST_APPROVAL": {
        const scriptDoc = await ports.storage.getActiveDocument(run.projectId, "SCRIPT");
        const scenes = (scriptDoc?.payload as { scenes?: { id: string }[] })?.scenes ?? [];
        const estimate = estimateMockProductionCost({
          sceneCount: scenes.length || 3,
          durationSeconds: 15,
          strategy: "balance",
        });
        await ports.storage.saveDocument({
          projectId: run.projectId,
          docType: "COST_ESTIMATE",
          payload: estimate as unknown as Record<string, unknown>,
          userId,
        });
        await this.requestApproval(run, ports, userId, "COST", "COST_ESTIMATE", "Утвердите бюджет (mock)");
        await ports.onChatBlocks?.([
          {
            type: "cost_estimate",
            demo: true,
            title: "Оценка стоимости (MOCK)",
            disclaimer: "Синтетические тарифы, без реальных списаний",
            totalLabel: `$${estimate.totalUsd.toFixed(2)}`,
            lines: estimate.lines.map((l) => ({ label: l.label, amountLabel: `$${l.amountUsd.toFixed(2)}` })),
          },
        ]);
        break;
      }
      case "QUEUED":
      case "PRODUCING": {
        const scriptDoc = await ports.storage.getActiveDocument(run.projectId, "SCRIPT");
        const storyDoc = await ports.storage.getActiveDocument(run.projectId, "STORYBOARD");
        const scenes = (scriptDoc?.payload as { scenes?: { id: string }[] })?.scenes?.map((s) => s.id) ?? ["scene-1"];
        const graph = planProductionGraph({
          runId: run.id,
          sceneIds: scenes,
          scriptVersion: scriptDoc?.version ?? 1,
          storyboardVersion: storyDoc?.version ?? 1,
        });
        await ports.storage.updateRunState(run.id, {
          metadata: { ...run.metadata, productionGraphPlanned: true, graphNodeCount: graph.length },
        });
        await ports.storage.emitEvent("production.step.queued", { runId: run.id, nodeCount: graph.length });
        break;
      }
      case "QUALITY_CHECK":
      case "READY_FOR_DELIVERY":
      case "COMPLETED":
        await ports.storage.emitEvent("delivery.ready", { runId: run.id, mock: true });
        break;
      default:
        break;
    }
  }

  private async requestApproval(
    run: NonNullable<Awaited<ReturnType<ProductionStoragePort["getRun"]>>>,
    ports: OrchestratorPorts,
    userId: string,
    targetType: string,
    docType: string,
    title: string,
  ) {
    const doc = await ports.storage.getActiveDocument(run.projectId, docType);
    if (!doc) throw new Error(`Missing document ${docType}`);
    const already = await ports.approvals.isApproved(run.projectId, targetType, doc.id, String(doc.version));
    if (already) return;
    if (!run.conversationId) throw new Error("Conversation required for approval");
    await ports.approvals.request({
      projectId: run.projectId,
      conversationId: run.conversationId,
      userId,
      targetType,
      targetId: doc.id,
      targetVersion: String(doc.version),
      payload: doc.payload,
      title,
    });
    await ports.storage.emitEvent("approval.required", { runId: run.id, targetType, targetId: doc.id });
  }
}
