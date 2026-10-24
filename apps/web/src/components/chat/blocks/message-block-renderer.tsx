"use client";

import type { MessageBlock } from "@shotbro/contracts";
import { ApprovalCard } from "./approval-card";
import { AgentActivity } from "./agent-activity";
import { CostEstimateCard } from "./cost-estimate-card";
import { ErrorCard } from "./error-card";
import { GenerationPlanCard } from "./generation-plan-card";
import { ImageResultCard } from "./image-result-card";
import { ModelComparisonCard } from "./model-comparison-card";
import { ScriptCard } from "./script-card";
import { StoryboardViewer } from "./storyboard-viewer";
import { TextBlockView } from "./text-block";
import { ToolExecutionCard } from "./tool-execution-card";
import { VersionHistoryCard } from "./version-history-card";
import { VideoResultCard } from "./video-result-card";
import { ProductionBoardCard } from "./production-board-card";
import { AudioResultCard } from "./audio-result-card";
import { ProviderStatusCard } from "./provider-status-card";
import { ProductionProgressCard } from "./production-progress-card";
import { DeliveryCard } from "./delivery-card";

export function MessageBlockRenderer({
  block,
  projectId,
}: {
  block: MessageBlock;
  projectId: string;
}) {
  switch (block.type) {
    case "text":
      return <TextBlockView markdown={block.markdown} />;
    case "generation_plan":
      return <GenerationPlanCard block={block} />;
    case "script":
      return <ScriptCard block={block} />;
    case "approval":
      return <ApprovalCard block={block} projectId={projectId} />;
    case "cost_estimate":
      return <CostEstimateCard block={block} />;
    case "model_comparison":
      return <ModelComparisonCard block={block} />;
    case "image_result":
      return <ImageResultCard block={block} />;
    case "video_result":
      return <VideoResultCard block={block} />;
    case "audio_result":
      return <AudioResultCard block={block} />;
    case "storyboard":
      return <StoryboardViewer block={block} />;
    case "tool_execution":
      return <ToolExecutionCard block={block} />;
    case "error":
      return <ErrorCard block={block} projectId={projectId} />;
    case "agent_activity":
      return <AgentActivity block={block} />;
    case "production_board":
      return <ProductionBoardCard block={block} projectId={projectId} />;
    case "provider_status":
      return <ProviderStatusCard block={block} />;
    case "production_progress":
      return <ProductionProgressCard block={block} />;
    case "delivery":
      return <DeliveryCard block={block} />;
    case "version_history":
      return <VersionHistoryCard block={block} />;
    default:
      return null;
  }
}
