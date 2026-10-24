# Phase 4 — Provider matrix

| Provider | Adapter | Contract tests | Live request verified |
|----------|---------|----------------|------------------------|
| mock (LLM) | **IMPLEMENTED** | — | **BLOCKED BY POLICY** |
| openrouter (LLM) | **IMPLEMENTED** (`OpenRouterLlmAdapter`) | **NOT IMPLEMENTED** | **BLOCKED BY POLICY** |
| image (generic) | **NOT IMPLEMENTED** | — | **BLOCKED BY POLICY** |
| video (generic) | **NOT IMPLEMENTED** | — | **BLOCKED BY POLICY** |
| elevenlabs | **NOT IMPLEMENTED** | — | **BLOCKED BY POLICY** |

HTTP default: `BlockedHttpTransport` — no outbound calls in Phase 4 tests.
