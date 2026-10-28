# Phase 5K — Agent Integration acceptance

**Status:** **NOT ACCEPTED** (2026-10-28) — P0 OpenRouter + agent E2E **fixed**; full acceptance **blocked on regression-strict**

## Runtime (VPS `85.117.235.93`)

| Service | `org.shotbro.build-sha` | Image ID (short) | Notes |
|---------|-------------------------|------------------|--------|
| API | **41e3f8bc** | `sha256:d1a00cd3…` | OpenRouter proxy transport + multi-turn tool messages |
| Web | **23b00c83** (prior deploy) | `infra-web-1` | E2E `asset-card-{id}` testids in tree |
| Worker | **366716e** | unchanged | mock media / upload READY |
| Git (VPS src) | **41e3f8bc** | `/var/www/ai.shotbro.ru-src` | branch `phase5/creative-studio` |

Baseline reference: **4d3872a9** (5K LLM loop in tree).

## OpenRouter RCA (confirmed)

| Path | Result |
|------|--------|
| Direct egress from API container | **HTTP 403** — datacenter IP blocked (`Access denied by security policy`) |
| Via `OPENROUTER_HTTPS_PROXY` | **HTTP 200** on `/api/v1/models` |
| Root cause of 0-token failures | Direct-only calls + staging compose hard-off + bootstrap guard before hotfix |
| Follow-up failure after proxy | Invalid multi-turn messages (assistant tool_calls not in OpenAI shape) — fixed in **b4391f4** |

Transport: `packages/ai/src/providers/http-transport.ts` — `OPENROUTER_CONNECT_MODE=auto`, retry via proxy on 403 security policy (**d9ff1c1**).

## Live LLM policy (staging.env)

Configured by `infra/scripts/phase5k-configure-staging-llm.sh` (secrets not logged).

| Flag / limit | Typical staging value |
|--------------|----------------------|
| `LLM_LIVE_EXECUTION_ENABLED` | `true` |
| `OPENROUTER_ENABLED` | `true` |
| `OPENROUTER_DEFAULT_MODEL` | `openai/gpt-4o-mini` |
| `OPENROUTER_MODEL_ALLOWLIST` | `openai/gpt-4o-mini` |
| `CREATIVE_AGENT_MAX_*` / daily USD caps | enforced server-side |
| Media / provider live flags | **all false**; `AI_MOCK_MODE=true` |

## Evidence (2026-10-28)

| Check | Result | Log / command |
|-------|--------|----------------|
| Media guards | **PASS** | `phase5k-media-guard-smoke.sh` → `PHASE5K_MEDIA_GUARD_PASS` |
| Live OpenRouter smoke | **PASS** | `phase5k-live-llm-smoke.sh` → `PHASE5K_LIVE_LLM_SMOKE_PASS` (vitest integration, tokens > 0, `search_project_assets`, 0 provider jobs) |
| `phase5-agent-integration` | **PASS 2/2** | `/var/log/shotbro-e2e/phase5-agent-integration-41e3f8b.log` |
| Full `phase5k-acceptance-e2e.sh` | **FAIL** (in progress / stopped on regression) | `/var/log/shotbro-e2e/phase5k-acceptance-41e3f8bc.log` — `regression-strict` phase3/phase4 mock MP4 chain **8× FAIL @ 4.5m** |
| External media generation | **0** | provider jobs mock-only in live smoke |

## Git commits (5K recovery chain)

| SHA | Summary |
|-----|---------|
| `23b00c8` | Staging LLM ops, undici transport, E2E testids, scripts |
| `d9ff1c1` | Proxy retry after datacenter 403 |
| `b4391f4` | OpenAI-format assistant `tool_calls` for follow-up LLM turns |
| `b958c02` | First-frame tool session fallback; E2E success + poll |
| `41e3f8b` | Video assign fallback search; E2E assert by `sceneId` |

## Mock vs live

- Messages matching **`phase5k:`** → deterministic mock planner (no OpenRouter spend).
- Free Russian text on `creative-turn` → OpenRouter when live flags enabled.

## Commands

```bash
bash infra/scripts/phase5k-configure-staging-llm.sh
bash infra/scripts/phase5k-openrouter-rca.sh
bash infra/scripts/phase5k-openrouter-proxy-probe.sh
bash infra/scripts/phase5k-media-guard-smoke.sh
bash infra/scripts/phase5k-live-llm-smoke.sh
bash infra/scripts/staging-playwright-e2e.sh /var/www/ai.shotbro.ru-src phase5-agent-integration
bash infra/scripts/phase5k-acceptance-e2e.sh /var/www/ai.shotbro.ru-src /var/log/shotbro-e2e
```

## Remaining blockers to **ACCEPTED**

1. **`regression-strict`** — phase3/phase4 mock production MP4 delivery (8 failures); investigate worker/queue/timeouts (not 5K creative agent path).
2. Remaining suites in `phase5k-acceptance-e2e.sh` after regression green (user-journey, asset-library, storyboard, …).
3. Optional product ask: dedicated live smoke for **mutation** («первым кадром второй сцены») with F5 — covered by mock E2E; live path validated for search tool calling only.

## Phase 5L

**Not started.**
