/** Phase 1: provider SDK placeholder — no production API calls. */

export type ProviderKind = "openrouter" | "selectel" | "elevenlabs" | "video" | "image";

export interface ProviderStub {
  kind: ProviderKind;
  enabled: false;
  note: string;
}

export const PROVIDER_STUBS: ProviderStub[] = [
  { kind: "openrouter", enabled: false, note: "Phase 3" },
  { kind: "selectel", enabled: false, note: "Phase 4" },
];
