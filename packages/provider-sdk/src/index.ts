/** Phase 2: provider interfaces only — no API keys, no live calls */

export type ModelCapability = {
  slug: string;
  modalities: ("text" | "image" | "video" | "audio")[];
  maxContextTokens?: number;
};

export type CostEstimate = {
  currency: "USD";
  amount: number;
  simulated: boolean;
};

export interface ProviderAdapter {
  readonly id: string;
  listModels(): Promise<ModelCapability[]>;
  estimateCost(_input: unknown): Promise<CostEstimate>;
}

export const providerRegistry: ProviderAdapter[] = [];
