# Phase 3 — Tool Executor matrix

| Tool | Handler registered | Zod input | Side-effect | Idempotency | Test | Status |
|------|-------------------|-----------|-------------|-------------|------|--------|
| get_project_context | **No** | empty | READ_ONLY | via ToolExecution | — | **NOT IMPLEMENTED** (orchestrator uses storage directly) |
| update_project_brief | **No** | empty | DATABASE_WRITE | — | pipeline unit | **PARTIAL** (BriefBuilder in orchestrator) |
| create_production_plan | **No** | empty | DATABASE_WRITE | — | pipeline | **PARTIAL** |
| create_script | **No** | empty | DATABASE_WRITE | — | pipeline | **PARTIAL** |
| create_storyboard | **No** | empty | DATABASE_WRITE | — | pipeline | **PARTIAL** |
| estimate_cost | **No** | empty | READ_ONLY | — | cost-engine | **PARTIAL** |
| request_approval | **No** | empty | DATABASE_WRITE | — | approval-flow int. | **PARTIAL** (ApprovalsService) |
| prepare_image_prompt | **No** | empty | READ_ONLY | — | — | **NOT IMPLEMENTED** |
| generate.image | **No** | empty | EXTERNAL_PAID | ToolExecution | worker mock | **ADAPTER_PENDING** — mock via worker; executor blocks without handler |
| generate.video | **No** | empty | EXTERNAL_PAID | ToolExecution | worker mock | **ADAPTER_PENDING** — mock via worker |
| generate.voice | **No** | empty | EXTERNAL_PAID | ToolExecution | worker mock | **ADAPTER_PENDING** — mock via worker |
| compose_video | **No** | empty | LOCAL_MEDIA_PROCESSING | — | production-run | **PARTIAL** (worker FFmpeg) |

**EXTERNAL_PAID:** `ToolExecutor.assertSideEffectAllowed` + `@shotbro/config` guards — **TESTED** in `phase3-guards.test.ts`.

**Mock production path:** does not require full ToolExecutor handlers; worker + orchestrator cover E2E.
