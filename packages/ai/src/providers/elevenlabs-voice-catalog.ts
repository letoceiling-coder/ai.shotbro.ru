/** Static voice catalog shape — populated from ElevenLabs API in live mode; fixtures in mock. */

export type VoiceCatalogEntry = {
  voiceId: string;
  name: string;
  language?: string;
  provider: "elevenlabs";
  availableModels: string[];
  voiceSettings?: { stability?: number; similarity_boost?: number; style?: number; speed?: number };
  previewAssetId?: string;
  availability: "MOCK" | "CONFIGURED";
  version: number;
};

export const ELEVENLABS_VOICE_CATALOG_FIXTURE: VoiceCatalogEntry[] = [
  {
    voiceId: "mock-voice-en-1",
    name: "Mock English Narrator",
    language: "en",
    provider: "elevenlabs",
    availableModels: ["eleven_multilingual_v2"],
    voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
    availability: "MOCK",
    version: 1,
  },
  {
    voiceId: "mock-voice-ru-1",
    name: "Mock Russian Narrator",
    language: "ru",
    provider: "elevenlabs",
    availableModels: ["eleven_multilingual_v2"],
    availability: "MOCK",
    version: 1,
  },
];
