/** Phase 1: architecture stubs for future agent orchestration (no live providers). */

export const TOOL_IDS = [
  "analyze_image",
  "generate_image",
  "edit_image",
  "generate_script",
  "create_storyboard",
  "generate_first_frame",
  "generate_video",
  "generate_voice",
  "generate_music",
  "synchronize_lips",
  "merge_scenes",
  "render_video",
  "upscale_media",
  "inspect_media",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  availableInDemo: boolean;
}

export const DEMO_TOOL_REGISTRY: ToolDefinition[] = TOOL_IDS.map((id) => ({
  id,
  name: id,
  description: `Demo placeholder for ${id}`,
  availableInDemo: true,
}));

export type AgentOrchestrator = {
  readonly phase: 1;
  readonly mode: "demo";
};

export const agentOrchestratorStub: AgentOrchestrator = {
  phase: 1,
  mode: "demo",
};
