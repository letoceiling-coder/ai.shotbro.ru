export type CostLine = {
  label: string;
  amountUsd: number;
  mock: boolean;
  priceStatus: "KNOWN" | "UNKNOWN";
};

export type CostEstimateResult = {
  lines: CostLine[];
  totalUsd: number;
  maximumUsd: number;
  mock: true;
};

const MOCK_RATES = {
  imagePerScene: 0.05,
  videoPerScene: 0.25,
  voicePerMinute: 0.08,
  assembly: 0,
} as const;

export function estimateMockProductionCost(input: {
  sceneCount: number;
  durationSeconds: number;
  strategy: "economy" | "balance" | "quality" | "manual";
}): CostEstimateResult {
  const mult = input.strategy === "economy" ? 0.8 : input.strategy === "quality" ? 1.3 : 1;
  const lines: CostLine[] = [
    {
      label: "Mock image (per scene)",
      amountUsd: input.sceneCount * MOCK_RATES.imagePerScene * mult,
      mock: true,
      priceStatus: "KNOWN",
    },
    {
      label: "Mock video (per scene)",
      amountUsd: input.sceneCount * MOCK_RATES.videoPerScene * mult,
      mock: true,
      priceStatus: "KNOWN",
    },
    {
      label: "Mock voiceover",
      amountUsd: (input.durationSeconds / 60) * MOCK_RATES.voicePerMinute * mult,
      mock: true,
      priceStatus: "KNOWN",
    },
    { label: "Local FFmpeg assembly", amountUsd: MOCK_RATES.assembly, mock: true, priceStatus: "KNOWN" },
  ];
  const totalUsd = lines.reduce((s, l) => s + l.amountUsd, 0);
  return { lines, totalUsd, maximumUsd: totalUsd * 1.15, mock: true };
}
