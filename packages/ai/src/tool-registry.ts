export type ToolDefinition = {
  id: string;
  displayName: string;
  description: string;
  /** Phase 3: JSON schema for arguments */
  inputSchemaVersion: number;
  enabled: boolean;
  requiresApproval: boolean;
};

const BUILTIN: ToolDefinition[] = [
  {
    id: "project.read",
    displayName: "Read project",
    description: "Load project metadata and settings",
    inputSchemaVersion: 1,
    enabled: true,
    requiresApproval: false,
  },
  {
    id: "media.analyze",
    displayName: "Analyze media",
    description: "Inspect uploaded assets (no generative AI in Phase 2)",
    inputSchemaVersion: 1,
    enabled: true,
    requiresApproval: false,
  },
  {
    id: "generate.image",
    displayName: "Generate image",
    description: "Paid generative image — blocked in Phase 2",
    inputSchemaVersion: 1,
    enabled: false,
    requiresApproval: true,
  },
];

export class ToolRegistry {
  constructor(private readonly tools: ToolDefinition[] = BUILTIN) {}

  list(): ToolDefinition[] {
    return this.tools.map((t) => ({ ...t }));
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.find((t) => t.id === id);
  }

  assertRunnable(id: string): ToolDefinition {
    const t = this.get(id);
    if (!t) throw new Error(`Unknown tool: ${id}`);
    if (!t.enabled) throw new Error(`Tool disabled: ${id}`);
    return t;
  }
}
