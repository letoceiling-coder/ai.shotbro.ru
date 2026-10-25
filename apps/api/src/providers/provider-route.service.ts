import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import {
  Phase4MockImageProvider,
  ProviderFallbackPlanner,
  SceneModelSettingsSchema,
  type CanonicalSceneSettings,
  type ProviderJobRouteMetadata,
  type ProviderRoutePlan,
} from "@shotbro/ai";
import { loadEnvFromProcess } from "@shotbro/config/env";
import type { Db } from "@shotbro/db/client";
import { project, providerLogicalOperation } from "@shotbro/db/schema";
import { DB } from "../database/database.module";
import { AccessPolicyService } from "../access/access-policy.service";
import { EventLogService } from "../events/event-log.service";
import { CostReservationService } from "../production/cost-reservation.service";
import { ProjectMemoryService } from "../production/project-memory.service";
import { ProviderJobRuntimeService } from "./provider-job-runtime.service";
import { DrizzleProviderJobStore } from "./drizzle-provider-job.store";
const ROUTE_EVENT_TYPES = new Set([
  "provider.route.planned",
  "provider.unavailable",
  "provider.fallback.proposed",
  "provider.fallback.approved",
  "provider.fallback.started",
  "provider.fallback.completed",
  "provider.fallback.failed",
  "provider.reconciliation.required",
  "provider.pricing.unknown",
  "provider.fallback.approval",
]);

@Injectable()
export class ProviderRouteService {
  private readonly env = loadEnvFromProcess();
  private readonly mockImage = new Phase4MockImageProvider();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(AccessPolicyService) private readonly access: AccessPolicyService,
    @Inject(EventLogService) private readonly events: EventLogService,
    @Inject(CostReservationService) private readonly cost: CostReservationService,
    @Inject(ProjectMemoryService) private readonly memory: ProjectMemoryService,
    @Inject(ProviderJobRuntimeService) private readonly runtime: ProviderJobRuntimeService,
  ) {}

  private async workspaceId(projectId: string) {
    const [row] = await this.db.select().from(project).where(eq(project.id, projectId)).limit(1);
    if (!row) throw new ConflictException("project_not_found");
    return row.workspaceId;
  }

  private settingsFromScene(
    sceneId: string,
    operation: CanonicalSceneSettings["operation"],
    memPrefs: Record<string, unknown>,
    overrides: Partial<CanonicalSceneSettings> = {},
  ): CanonicalSceneSettings {
    const raw = (memPrefs.sceneModelSettings as Record<string, unknown> | undefined)?.[sceneId];
    const parsed = SceneModelSettingsSchema.parse({ sceneId, version: 1, parameters: {}, ...(raw ?? {}) });
    return {
      sceneId,
      operation,
      aspectRatio: "9:16",
      fallbackMode: parsed.fallbackMode,
      strictVoiceConsistency: parsed.strictVoiceConsistency,
      primaryProviderId: parsed.primaryProviderId,
      primaryModelId: parsed.primaryModelId ?? parsed.imageModelId,
      approvedMaxCostUsd: (memPrefs.approvedMaxCostUsd as number | undefined) ?? undefined,
      reservedBudgetUsd: (memPrefs.reservedBudgetUsd as number | undefined) ?? undefined,
      consumedBudgetUsd: (memPrefs.consumedBudgetUsd as number | undefined) ?? undefined,
      ...overrides,
    };
  }

  private routeMetadataFromPlan(plan: ProviderRoutePlan, settings: CanonicalSceneSettings): ProviderJobRouteMetadata {
    const requested = plan.primary ?? plan.selected!;
    const selected = plan.selected ?? plan.primary!;
    return {
      requestedProvider: requested.providerId,
      requestedModel: requested.modelId,
      selectedProvider: selected.providerId,
      selectedModel: selected.modelId,
      operation: plan.operation,
      fallbackReason: plan.fallbackReason,
      fallbackAttempt: plan.routePlanVersion ? plan.routePlanVersion - 1 : 0,
      originalSettingsSnapshot: plan.originalSettingsSnapshot as Record<string, unknown>,
      translatedSettingsSnapshot: plan.translatedSettingsSnapshot,
      approvedBudgetUsd: settings.approvedMaxCostUsd,
      estimatedCostUsd: null,
      reservedBudgetUsd: settings.reservedBudgetUsd,
      consumedBudgetUsd: settings.consumedBudgetUsd,
      reconciliationStatus: plan.status === "NEEDS_RECONCILIATION" ? "NEEDS_RECONCILIATION" : "NONE",
      routePlanVersion: plan.routePlanVersion ?? 1,
      planStatus: plan.status,
      duplicateJobPrevented: plan.duplicateJobPrevented,
    };
  }

  async emitRouteEvents(input: {
    workspaceId: string;
    projectId: string;
    logicalOperationId: string;
    runId?: string;
    routePlanVersion: number;
    plan: ProviderRoutePlan;
    providerJobId?: string;
  }) {
    for (const [idx, ev] of input.plan.events.entries()) {
      if (!ROUTE_EVENT_TYPES.has(ev.type) && !ev.type.startsWith("provider.")) continue;
      const eventId = `${input.logicalOperationId}:${ev.type}:v${input.routePlanVersion}:${idx}`;
      await this.events.append({
        id: eventId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        resourceId: input.providerJobId ?? input.logicalOperationId,
        type: ev.type,
        payload: {
          logicalOperationId: input.logicalOperationId,
          routePlanVersion: input.routePlanVersion,
          runId: input.runId,
          providerJobId: input.providerJobId,
          message: ev.message,
          planStatus: input.plan.status,
          selectedProvider: input.plan.selected?.providerId,
          selectedModel: input.plan.selected?.modelId,
          fallbackReason: input.plan.fallbackReason,
          safe: true,
        },
      });
    }
  }

  async planAndPersist(
    userId: string,
    projectId: string,
    sceneId: string,
    body: Partial<CanonicalSceneSettings> & {
      operation: CanonicalSceneSettings["operation"];
      primaryUnavailable?: boolean;
      failureClass?: "PRE_SUBMIT_FAILURE" | "POST_SUBMIT_AMBIGUOUS";
      providerRecovered?: boolean;
      fallbackEstimateUsd?: number;
      runId?: string;
    },
  ) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const mem = await this.memory.get(userId, projectId);
    const prefs = (mem.preferences ?? {}) as Record<string, unknown>;

    const [existing] = await this.db
      .select()
      .from(providerLogicalOperation)
      .where(and(eq(providerLogicalOperation.projectId, projectId), eq(providerLogicalOperation.sceneId, sceneId)))
      .orderBy(desc(providerLogicalOperation.updatedAt))
      .limit(1);

    const settings = this.settingsFromScene(sceneId, body.operation, prefs, body);
    const planner = new ProviderFallbackPlanner(this.env);
    const plan = planner.plan(settings, {
      primaryUnavailable: body.primaryUnavailable,
      failureClass: body.failureClass,
      providerRecovered: body.providerRecovered,
      existingAttemptCount: existing?.routePlanVersion ?? 0,
      fallbackEstimateUsd: body.fallbackEstimateUsd,
    });

    const logicalOperationId = existing?.id ?? uuid();
    const routePlanVersion = plan.routePlanVersion ?? 1;
    const workspaceId = await this.workspaceId(projectId);

    if (existing) {
      await this.db
        .update(providerLogicalOperation)
        .set({
          routePlanVersion,
          latestStatus: plan.status,
          planSnapshot: plan as unknown as Record<string, unknown>,
          operation: body.operation,
          runId: body.runId ?? existing.runId,
          updatedAt: new Date(),
        })
        .where(eq(providerLogicalOperation.id, logicalOperationId));
    } else {
      await this.db.insert(providerLogicalOperation).values({
        id: logicalOperationId,
        projectId,
        sceneId,
        runId: body.runId ?? null,
        operation: body.operation,
        routePlanVersion,
        latestStatus: plan.status,
        planSnapshot: plan as unknown as Record<string, unknown>,
      });
    }

    await this.emitRouteEvents({
      workspaceId,
      projectId,
      logicalOperationId,
      runId: body.runId,
      routePlanVersion,
      plan,
    });

    let reservation: Awaited<ReturnType<CostReservationService["reserve"]>> | null = null;
    if (plan.status === "FALLBACK_PLANNED" && settings.approvedMaxCostUsd) {
      reservation = await this.cost.reserve(userId, projectId, {
        amountUsd: 0,
        idempotencyKey: `route:${logicalOperationId}:v${routePlanVersion}`,
        agentRunId: body.runId,
        reason: `mock_route_fallback:${plan.selected?.providerId ?? "unknown"}`,
      });
    }

    return {
      logicalOperationId,
      routePlanVersion,
      plan,
      reservation,
      mockRoutingOnly: this.env.AI_MOCK_MODE || !this.env.PROVIDER_LIVE_EXECUTION_ENABLED,
    };
  }

  async simulatePrimaryFailure(
    userId: string,
    projectId: string,
    sceneId: string,
    body: { operation: CanonicalSceneSettings["operation"]; runId?: string; fallbackEstimateUsd?: number },
  ) {
    const result = await this.planAndPersist(userId, projectId, sceneId, {
      ...body,
      primaryUnavailable: true,
      failureClass: "PRE_SUBMIT_FAILURE",
    });

    let providerJobId: string | undefined;
    if (result.plan.status === "FALLBACK_PLANNED" && result.plan.selected) {
      const routeMeta = this.routeMetadataFromPlan(result.plan, result.plan.originalSettingsSnapshot);
      const manager = this.runtime.createManager();
      const job = await manager.submitWithAdapter(this.mockImage, {
        id: uuid(),
        projectId,
        runId: body.runId,
        sceneId,
        providerId: result.plan.selected.providerId,
        modelId: result.plan.selected.modelId,
        operation: body.operation,
        idempotencyKey: `route:${result.logicalOperationId}:job:v${result.routePlanVersion}`,
        input: { prompt: "mock-route-fallback", mock: true },
        userId,
        logicalOperationId: result.logicalOperationId,
        routePlanVersion: result.routePlanVersion,
        routeMetadata: routeMeta,
      });
      providerJobId = job.id;
      const workspaceId = await this.workspaceId(projectId);
      await this.emitRouteEvents({
        workspaceId,
        projectId,
        logicalOperationId: result.logicalOperationId,
        runId: body.runId,
        routePlanVersion: result.routePlanVersion,
        plan: {
          ...result.plan,
          events: [{ type: "provider.fallback.completed", message: "Mock provider job recorded" }],
        },
        providerJobId,
      });
    }

    return { ...result, providerJobId };
  }

  async getSceneRoute(userId: string, projectId: string, sceneId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const [row] = await this.db
      .select()
      .from(providerLogicalOperation)
      .where(and(eq(providerLogicalOperation.projectId, projectId), eq(providerLogicalOperation.sceneId, sceneId)))
      .orderBy(desc(providerLogicalOperation.updatedAt))
      .limit(1);

    const events = await this.events.listSince(projectId, undefined, 200);
    const routeEvents = events.filter(
      (e) => e.type.startsWith("provider.") && (e.payload?.logicalOperationId === row?.id || !row),
    );

    const jobs = row
      ? (await new DrizzleProviderJobStore(this.db).listByProject(projectId, 20)).filter(
          (j) => j.logicalOperationId === row.id,
        )
      : [];

    return {
      logicalOperation: row ?? null,
      plan: row?.planSnapshot ?? null,
      routeEvents,
      providerJobs: jobs,
      mock: true,
    };
  }

  async listRouteTimeline(userId: string, projectId: string) {
    await this.access.assertProjectAccess(this.db, userId, projectId);
    const events = await this.events.listSince(projectId, undefined, 300);
    return {
      items: events.filter((e) => e.type.startsWith("provider.")),
      mock: true,
    };
  }
}
