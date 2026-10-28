# Phase 5K — Agent Integration acceptance

**Status:** **NOT ACCEPTED** (2026-10-28 staging run)

## Runtime (VPS `85.117.235.93`)

| Service | `org.shotbro.build-sha` | Notes |
|---------|-------------------------|--------|
| Web | **4d3872a9** | `infra-web-1`, health ok |
| API | **4d3872a9** (+ local hotfixes on VPS for LLM bootstrap/proxy) | `ai-shotbro-staging-api-1` |
| Worker | **366716e** | unchanged; mock media processing |
| Git tree | **4d3872a9** | `/var/www/ai.shotbro.ru-src` |
| Disk | ~79% used, ~24 GB free | no deploy lock at last check |

## Live LLM policy (staging.env)

| Flag / limit | Value |
|--------------|--------|
| `LLM_LIVE_EXECUTION_ENABLED` | `true` |
| `OPENROUTER_ENABLED` | `true` |
| `OPENROUTER_DEFAULT_MODEL` | `openai/gpt-4o-mini` |
| `OPENROUTER_MODEL_ALLOWLIST` | `openai/gpt-4o-mini` |
| `CREATIVE_AGENT_MAX_ITERATIONS` | 6 |
| `CREATIVE_AGENT_MAX_TOOL_CALLS` | 12 |
| `CREATIVE_AGENT_MAX_OUTPUT_TOKENS` | 1536 |
| `CREATIVE_AGENT_RUN_MAX_COST_USD` | 0.12 |
| `OPENROUTER_USER_DAILY_MAX_USD` | 2.0 |
| Media flags | all **false**; `AI_MOCK_MODE=true`; `PROVIDER_LIVE_EXECUTION_ENABLED=false` |

`OPENROUTER_API_KEY` present (not logged). `OPENROUTER_HTTPS_PROXY` copied from server vault when missing.

## Evidence

| Check | Result |
|-------|--------|
| Media guard unit + EXTERNAL_PAID block | **PASS** (`phase5k-media-guard-smoke.sh` → `PHASE5K_MEDIA_GUARD_PASS`) |
| Live OpenRouter creative-turn | **FAIL** — `agent_run` FAILED, 0 tokens, 0 tools (outbound OpenRouter; proxy wiring in progress) |
| `phase5-agent-integration` E2E | **PARTIAL** — 1 passed / 1 failed (asset-card not visible after PNG upload; trace on VPS) |
| Full regression stack | **Not run** (blocked on agent E2E + live LLM) |

## Commands

```bash
bash infra/scripts/phase5k-configure-staging-llm.sh
bash infra/scripts/phase5k-media-guard-smoke.sh
bash infra/scripts/phase5k-live-llm-smoke.sh
bash infra/scripts/staging-playwright-e2e.sh /var/www/ai.shotbro.ru-src phase5-agent-integration
bash infra/scripts/phase5k-acceptance-e2e.sh   # full sequential suite when unblocked
```

Logs: `/var/log/shotbro-e2e/phase5-agent-integration-5k.log`, `/var/log/shotbro-e2e/api-redeploy-5k-proxy.log`

## Blockers to ACCEPTED

1. Green **live LLM smoke** (Russian NL, real `tool_calls`, DB mutation, usage > 0, 0 provider jobs).
2. Green **`phase5-agent-integration`** (both tests, retries=0).
3. Full **phase5k-acceptance-e2e** sequential PASS.
4. Commit + push hotfixes: compose LLM env, API bootstrap guard, OpenRouter proxy transport, scripts.

## Mock vs live

- E2E **`phase5k:`** prefix → deterministic mock planner (no OpenRouter spend).
- Free Russian text → OpenRouter when `LLM_LIVE_EXECUTION_ENABLED=true` and message routes to `creative-turn`.
