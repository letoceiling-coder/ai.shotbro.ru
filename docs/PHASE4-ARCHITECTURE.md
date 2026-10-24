# Phase 4 — Architecture

## Flow

```text
USER MESSAGE
  → ContextBuilder
  → LlmGateway (mock transport default)
  → AgentRuntime (tool loop + limits)
  → ToolPolicyEngine
  → ToolExecutor (handlers / ADAPTER_PENDING)
  → ProductionOrchestrator (existing mock-production)
  → Worker (FFmpeg / MinIO)
```

## Packages

| Package | Responsibility |
|---------|----------------|
| `@shotbro/ai` | LLM gateway, agent runtime, tools, providers, execution policy |
| `@shotbro/config` | Env guards (`AI_MOCK_MODE`, OpenRouter flags) |
| `@shotbro/contracts` | Zod production documents |
| `@shotbro/db` | Persistence (agent_run, tool_execution, generation_job) |
| `apps/api` | Auth, approvals, agent runs, AI registry endpoints |
| `apps/worker` | BullMQ media jobs |
| `apps/web` | Studio UI (Phase 4 cards — pending) |

## Execution modes

| Mode | Phase 4 |
|------|---------|
| `MOCK_ONLY` | **Active** |
| `LIVE_CONFIGURED_DISABLED` | Adapters compile; HTTP blocked |
| `LIVE_APPROVED` | Architected; not enabled |

## Security boundaries

- LLM never touches PostgreSQL directly — tools only.
- Provider HTTP requires `ExecutionPolicyEngine.assertProviderNetworkCall`.
- Paid side effects blocked in `ToolExecutor` + config guards.
