# Phase 4 — Tool Executor matrix

| Tool | Handler | Status | Notes |
|------|---------|--------|-------|
| get_project_context | Yes | **TESTED** (unit path) | |
| get_project_memory | Yes | **IMPLEMENTED** | |
| update_project_brief | Yes | **IMPLEMENTED** | Zod + persist |
| create_production_plan | Yes | **IMPLEMENTED** | |
| update_production_plan | Yes | **IMPLEMENTED** | |
| create_script | Yes | **IMPLEMENTED** | |
| update_script | Yes | **IMPLEMENTED** | |
| create_storyboard | Yes | **IMPLEMENTED** | |
| update_storyboard | Yes | **IMPLEMENTED** | |
| save_character | Yes | **IMPLEMENTED** | run metadata |
| get_character | Yes | **IMPLEMENTED** | |
| list_project_assets | Yes | **IMPLEMENTED** | empty list stub |
| attach_reference | throws | **ADAPTER_PENDING** | |
| prepare_image_prompt | Yes | **IMPLEMENTED** | |
| prepare_video_prompt | Yes | **IMPLEMENTED** | |
| prepare_voiceover | Yes | **IMPLEMENTED** | |
| compare_models | Yes | **IMPLEMENTED** | mock router |
| estimate_cost | Yes | **IMPLEMENTED** | |
| request_approval | throws | **ORCHESTRATOR_DELEGATE** | ApprovalsService |
| get_approval_status | Yes | **IMPLEMENTED** | |
| create_production_graph | throws | **ORCHESTRATOR_DELEGATE** | graph service |
| get_production_status | Yes | **IMPLEMENTED** | |
| pause_production | Yes | **IMPLEMENTED** | |
| cancel_production | Yes | **IMPLEMENTED** | |
| prepare_timeline | Yes | **IMPLEMENTED** | |
| compose_video | throws | **ADAPTER_PENDING** | worker FFmpeg |
| validate_media | Yes | **IMPLEMENTED** | mock valid |
| prepare_delivery | Yes | **IMPLEMENTED** | MOCK RESULT label |
| generate.image / video / voice | throws | **ADAPTER_PENDING** | policy blocks paid |

**Mock production:** continues via `ProductionOrchestrator` + worker (unchanged).
