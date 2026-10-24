# Phase 4 — Security report

**Scope:** Phase 4A–4D, branch `phase4/intelligent-production`, staging **b1de217**.

| Control | Status |
|---------|--------|
| `AI_MOCK_MODE=true` | **DEPLOYED** |
| Paid provider network hard block | **TESTED** |
| No public “enable AI execution” client flag | **IMPLEMENTED** — rollout via admin allowlist or loopback secret |
| AgentRuntime rollout audit events | **IMPLEMENTED** |
| Cross-project access (API guards) | **EXISTING** Phase 3 + rollout checks |
| SSE stream | **SessionGuard** + project access |
| Tool duplicate-call policy | **TESTED** (mock LLM iteration fix) |
| Webhook HMAC (mock provider) | **IMPLEMENTED** **DEPLOYED** |
| Asset ingestion SSRF | **TESTED** |
| Live OpenRouter / paid adapters | **BLOCKED BY POLICY** |

## 4D regression notes

- Internal rollout: loopback-only + `INTEGRATION_ROLLOUT_ENABLED` + secret (≥32 chars).
- Admin rollout: `PHASE4_ROLLOUT_ADMIN_EMAILS` — not exposed to arbitrary project members.
- `runtimeVersion` fixed at run creation — no mid-run mode switch.

Live provider verification: **NOT TESTED / BLOCKED BY POLICY**
