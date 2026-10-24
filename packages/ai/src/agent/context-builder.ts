import type { ProductionStoragePort } from "../ports/production-storage.js";

export type ContextSlice = {
  key: string;
  content: string;
  tokenEstimate: number;
};

export type BuiltAgentContext = {
  slices: ContextSlice[];
  compactText: string;
  tokenBudget: number;
  tokenUsedEstimate: number;
};

export type ContextBuilderInput = {
  userMessage: string;
  projectId: string;
  runId: string;
  storage: ProductionStoragePort;
  maxTokens?: number;
  brandGuidelines?: string;
};

export class ContextBuilder {
  async build(input: ContextBuilderInput): Promise<BuiltAgentContext> {
    const budget = input.maxTokens ?? 8_000;
    const slices: ContextSlice[] = [
      {
        key: "system_policy",
        content: "Policy: mock-only execution; no external paid inference; approvals required for production.",
        tokenEstimate: 40,
      },
      { key: "user_request", content: input.userMessage, tokenEstimate: Math.ceil(input.userMessage.length / 4) },
    ];

    if (input.brandGuidelines) {
      slices.push({
        key: "brand",
        content: input.brandGuidelines,
        tokenEstimate: Math.ceil(input.brandGuidelines.length / 4),
      });
    }

    const run = await input.storage.getRun(input.runId);
    if (run) {
      slices.push({
        key: "production_state",
        content: `productionState=${run.productionState}; status=${run.status}`,
        tokenEstimate: 20,
      });
    }

    for (const docType of ["BRIEF", "PRODUCTION_PLAN", "SCRIPT", "STORYBOARD"] as const) {
      const doc = await input.storage.getActiveDocument(input.projectId, docType);
      if (doc) {
        const snippet = JSON.stringify(doc.payload).slice(0, 1200);
        slices.push({
          key: `doc_${docType}`,
          content: snippet,
          tokenEstimate: Math.ceil(snippet.length / 4),
        });
      }
    }

    let used = 0;
    const kept: ContextSlice[] = [];
    for (const s of slices) {
      if (used + s.tokenEstimate > budget) break;
      kept.push(s);
      used += s.tokenEstimate;
    }

    const compactText = kept.map((s) => `[${s.key}]\n${s.content}`).join("\n\n");
    return { slices: kept, compactText, tokenBudget: budget, tokenUsedEstimate: used };
  }
}
