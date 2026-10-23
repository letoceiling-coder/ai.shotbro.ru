export type ToolSideEffectClass =
  | "READ_ONLY"
  | "DATABASE_WRITE"
  | "LOCAL_MEDIA_PROCESSING"
  | "EXTERNAL_FREE"
  | "EXTERNAL_PAID";

export type ToolCostClass = "free" | "estimate_required" | "paid";

export type Phase3ToolDefinition = {
  id: string;
  displayName: string;
  description: string;
  sideEffect: ToolSideEffectClass;
  costClass: ToolCostClass;
  enabled: boolean;
  requiresApproval: boolean;
};

export const PHASE3_TOOLS: Phase3ToolDefinition[] = [
  { id: "get_project_context", displayName: "Project context", description: "Load project memory and settings", sideEffect: "READ_ONLY", costClass: "free", enabled: true, requiresApproval: false },
  { id: "update_project_brief", displayName: "Update brief", description: "Persist production brief", sideEffect: "DATABASE_WRITE", costClass: "free", enabled: true, requiresApproval: false },
  { id: "create_production_plan", displayName: "Create plan", description: "Create production plan document", sideEffect: "DATABASE_WRITE", costClass: "free", enabled: true, requiresApproval: false },
  { id: "create_script", displayName: "Create script", description: "Create structured script", sideEffect: "DATABASE_WRITE", costClass: "free", enabled: true, requiresApproval: false },
  { id: "create_storyboard", displayName: "Create storyboard", description: "Create storyboard frames", sideEffect: "DATABASE_WRITE", costClass: "free", enabled: true, requiresApproval: false },
  { id: "estimate_cost", displayName: "Estimate cost", description: "Compute mock cost estimate", sideEffect: "READ_ONLY", costClass: "estimate_required", enabled: true, requiresApproval: false },
  { id: "request_approval", displayName: "Request approval", description: "Create approval request", sideEffect: "DATABASE_WRITE", costClass: "free", enabled: true, requiresApproval: false },
  { id: "prepare_image_prompt", displayName: "Image prompt", description: "Render image prompt", sideEffect: "READ_ONLY", costClass: "free", enabled: true, requiresApproval: false },
  { id: "generate.image", displayName: "Generate image", description: "Mock image generation", sideEffect: "EXTERNAL_PAID", costClass: "paid", enabled: true, requiresApproval: true },
  { id: "generate.video", displayName: "Generate video", description: "Mock video generation", sideEffect: "EXTERNAL_PAID", costClass: "paid", enabled: true, requiresApproval: true },
  { id: "generate.voice", displayName: "Generate voice", description: "Mock TTS", sideEffect: "EXTERNAL_PAID", costClass: "paid", enabled: true, requiresApproval: true },
  { id: "compose_video", displayName: "Compose video", description: "FFmpeg local assembly", sideEffect: "LOCAL_MEDIA_PROCESSING", costClass: "free", enabled: true, requiresApproval: false },
];
