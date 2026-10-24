import type { ProviderAdapter } from "./types.js";
import { MockProviderAdapter } from "./mock-provider.js";

export type ProviderKind = "llm" | "image" | "video" | "audio" | "media_processing";

export type RegisteredProvider = {
  id: string;
  kind: ProviderKind;
  adapter: ProviderAdapter;
  enabled: boolean;
};

export class ProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();

  constructor(initial: RegisteredProvider[] = []) {
    for (const p of initial) this.providers.set(p.id, p);
  }

  static withDefaults(): ProviderRegistry {
    return new ProviderRegistry([
      { id: "mock", kind: "llm", adapter: new MockProviderAdapter(), enabled: true },
    ]);
  }

  register(entry: RegisteredProvider) {
    this.providers.set(entry.id, entry);
  }

  list(): RegisteredProvider[] {
    return [...this.providers.values()];
  }

  get(id: string): RegisteredProvider | undefined {
    return this.providers.get(id);
  }
}
