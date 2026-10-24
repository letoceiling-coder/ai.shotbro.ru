# Phase 4 — Tool Executor matrix

| Tool | Handler | Integration | Status |
|------|---------|-------------|--------|
| get_project_context | Yes | storage | **TESTED** path |
| list_project_assets | Yes | `AssetsService` delegate | **INTEGRATED** |
| attach_reference | Yes | asset ownership check | **INTEGRATED** |
| validate_media | Yes | list + mime | **INTEGRATED** |
| request_approval | Yes | `ApprovalsService` | **INTEGRATED** |
| create_production_graph | Yes | `ProductionGraphService` | **INTEGRATED** |
| compose_video | Yes | graph/worker enqueue | **INTEGRATED** |
| generate.image/video/voice | Yes | `ProviderJobManager` mock PG | **INTEGRATED** |
| estimate_cost / script / storyboard | Yes | pipeline + Zod | **IMPLEMENTED** |

Mock production default (`PHASE4_AGENT_RUNTIME_ENABLED=false`): **ProductionOrchestrator only** (Phase 3).

With flag **true**: AgentRuntime mock LLM turn → same orchestrator (one `AgentRun`).
