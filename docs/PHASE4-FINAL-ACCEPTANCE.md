# Phase 4 — Final acceptance

**Status:** Phase 4C **staging accepted** (mock-only policy). Playwright multi-viewport UI regression **not re-run in this session** — API smokes cover both production paths.

**Branch:** `phase4/intelligent-production`  
**Git HEAD:** `e135d00`  
**Baseline:** `phase3-rc1` → `e66d480`  
**Prior checkpoints:** `7e95f19` (4B), `6687b0b` (4C scaffold), `db00c2f` (provider ingestion)

## Policy (confirmed)

| Metric | Value |
|--------|-------|
| Real OpenRouter inference | **0** |
| Real image / video / TTS | **0** |
| Production cutover | **NOT PERFORMED** |
| `AI_MOCK_MODE` | **true** (compose + staging) |
| `PHASE4_AGENT_RUNTIME_ENABLED` (staging default) | **false** (enabled only for scoped unified smoke) |

## Staging deployment

| Item | Value |
|------|--------|
| Deployed SHA | **`e135d00`** (`DEPLOYED.txt` on VPS) |
| DB backup (pre-4C) | `/var/backups/shotbro-staging-pre-phase4c-20261024.sql.gz` |
| Migration **0005** | **Applied** — `provider_job`, `provider_job_event`, `provider_execution_attempt` |
| Docker API image | `ai-shotbro-staging-api:latest` → `2753ab1fed3d` |
| Docker Worker image | `ai-shotbro-staging-worker:latest` → `bd041f05f035` |
| Web | Host/orphan `ai-shotbro-staging-web-1` (unchanged static; API/worker carry Phase 4 backend) |

## E2E / smoke (staging, mock MP4 in MinIO)

| Scenario | Command / spec | Result |
|----------|----------------|--------|
| Phase 3 fallback (`PHASE4_AGENT_RUNTIME_ENABLED=false`) | `infra/scripts/staging-phase3-agent-smoke.sh` | **PASS** (2026-10-24) |
| Phase 4 unified agent (flag **true**, test project only) | `infra/scripts/staging-phase4-unified-smoke.sh` | **PASS** — single `runId`, `traceId`, `mock-delivery` MP4 |
| Playwright `phase3-mock-production.spec.ts` × viewports | Not executed this session | **Skipped** — re-run with `E2E_STAGING_URL` + credentials for UI sign-off |

## Deliverables matrix (4C)

| Area | Status |
|------|--------|
| ProviderJob PostgreSQL + scheduler poll | **DEPLOYED** **TESTED** (mock) |
| Mock provider → MinIO ingestion | **INTEGRATED** (`ProviderJobsService.ingestMockOutputsIfNeeded`) |
| Webhook HMAC receiver | **DEPLOYED** (mock secret on VPS only) |
| AgentRuntime → Orchestrator (one `runId`) | **INTEGRATED** **TESTED** (unified smoke) |
| Mock LLM iteration dedupe | **FIXED** (`mock-llm-fixtures` iteration gate) |
| Production UI blocks (provider_status, production_progress, delivery) | **IMPLEMENTED** (web); live SSE fill **partial** |
| Trace API | **TESTED** (unified smoke) |
| Cost / approval hardening | Phase 3 path unchanged; mock usage only |
| Security unit gates | `phase4-security.integration.spec.ts` + `@shotbro/ai` guards **TESTED** |

## Unit / integration (local CI)

| Suite | Result |
|-------|--------|
| `@shotbro/ai` vitest | **32/32 passed** |
| `api typecheck` | **passed** (Docker build gate) |
| `RUN_DB_INTEGRATION_TESTS=1` provider job DB | Optional — run on isolated PG before live policy change |

## Remaining / non-blockers

- Playwright desktop/tablet/mobile regression on staging UI (recommended before production cutover).
- Emit `provider_status` / `delivery` blocks from worker/orchestrator into chat (cards exist; backend events partial).
- Per-project feature flag for Phase 4 (today: global env flag for smoke only).
- Live provider adapters remain **BLOCKED BY POLICY**.

## Sign-off criterion (4C)

Both mock production paths complete with **real mock MP4 asset in S3/MinIO** on staging:

1. Phase 3 fallback — **confirmed**  
2. Phase 4 unified intelligent agent — **confirmed**

No paid AI API usage. Production cutover **not** performed.
