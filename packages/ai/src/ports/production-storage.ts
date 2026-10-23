import type { AgentProductionState } from "@shotbro/contracts";
import type { ToolSideEffectClass } from "../tool-side-effects.js";

export type StoredDocument = {
  id: string;
  docType: string;
  version: number;
  payload: Record<string, unknown>;
};

export type ToolExecutionRecord = {
  id: string;
  toolName: string;
  idempotencyKey?: string;
  status: string;
  output?: Record<string, unknown>;
};

export type ProductionStoragePort = {
  getRun(runId: string): Promise<{
    id: string;
    projectId: string;
    conversationId: string | null;
    productionState: AgentProductionState;
    status: string;
    triggerMessage: string | null;
    metadata: Record<string, unknown>;
  } | null>;

  updateRunState(
    runId: string,
    patch: {
      productionState?: AgentProductionState;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;

  saveDocument(input: {
    projectId: string;
    docType: string;
    payload: Record<string, unknown>;
    userId: string;
    supersedePrevious?: boolean;
  }): Promise<StoredDocument>;

  getActiveDocument(projectId: string, docType: string): Promise<StoredDocument | null>;

  findToolExecution(agentRunId: string, idempotencyKey: string): Promise<ToolExecutionRecord | null>;

  saveToolExecution(input: {
    id: string;
    agentRunId: string;
    toolName: string;
    sideEffect: ToolSideEffectClass;
    idempotencyKey: string;
    status: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  }): Promise<void>;

  emitEvent(type: string, payload: Record<string, unknown>, resourceId?: string): Promise<void>;
};
