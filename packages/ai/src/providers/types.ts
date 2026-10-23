export type ProviderRequest = {
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  maxOutputTokens?: number;
};

export type ProviderResponse = {
  content: string;
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
};

export interface ProviderAdapter {
  readonly id: string;
  complete(req: ProviderRequest): Promise<ProviderResponse>;
}
