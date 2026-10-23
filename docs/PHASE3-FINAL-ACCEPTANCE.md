# Phase 3 — Final acceptance (staging)

**Branch:** `phase3/agent`  
**Git SHA (staging deploy):** `6dcc810` (+ local commits for e2e/integration test fixes pending push)  
**Prior checkpoint:** `b98a9ee` — production approval gate, worker delivery  
**Hotfix:** `6dcc810` — orchestrator continues past `READY_FOR_PRODUCTION`

## Deploy

| Service | Image ID | Status |
|---------|----------|--------|
| API | `sha256:1ce0e91bf37b52ee87b2aa0b490be1b8e70425f31a45124623c0a9604ab064e2` | DEPLOYED |
| Worker | `sha256:0b9de40b930b8a6bdf74c7f974ec663cf35c5a20dc78ea13a3eb20128e29d592` | DEPLOYED |
| Web (infra-web) | `sha256:8cf6dbec4b5ff8b7e6984337bab0bf2b48ae813b277df9191e1f5ce5c9bfebcc` | DEPLOYED (b98a9ee UI) |

**Backup:** `/var/backups/shotbro-staging-phase3-20261023-2236/pg.sql.gz` — restore tested OK  
**Migrations:** 0000–0003 journal aligned — see [PHASE3-MIGRATION-STAGING.md](./PHASE3-MIGRATION-STAGING.md)

## Tests (recorded)

| Suite | Result |
|-------|--------|
| `@shotbro/ai` unit | **9/9 pass** |
| API/worker/web `tsc` | **pass** |
| `phase3-full-agent.integration.spec.ts` (staging) | **2/2 pass** — full agent → COMPLETED, MinIO video GET |
| `agent-production.integration.spec.ts` | skip unless `INTEGRATION_API_URL` |
| Phase 2 integration (20) | not re-run this session |
| Playwright `phase3-mock-production.spec.ts` (desktop, staging) | **1/1 pass** (~28s) |

## Production approval flow

| Step | IMPLEMENTED | TESTED |
|------|-------------|--------|
| PLAN / SCRIPT / STORYBOARD / COST approvals | ✓ | integration + playwright |
| **PRODUCTION_APPROVAL** (separate from COST) | ✓ | integration + playwright |
| Budget reserve after COST, before production | ✓ | integration |
| Reject → CANCEL + release | ✓ | code |
| Idempotent `production.run` job | ✓ | worker log |
| Mock DAG → FFmpeg → DELIVERY asset | ✓ | integration (MinIO) |
| Chat `video_result` + `assetId` | ✓ | worker |

## Tool executor (PHASE3_TOOLS)

| Tool | Handler | Status |
|------|---------|--------|
| get_project_context | partial / orchestrator path | IMPLEMENTED |
| update_project_brief | pipeline | IMPLEMENTED |
| create_production_plan | pipeline | IMPLEMENTED |
| create_script / storyboard | pipeline | IMPLEMENTED |
| estimate_cost | cost-engine | IMPLEMENTED |
| request_approval | ApprovalsService | IMPLEMENTED |
| prepare_image_prompt | mock | partial |
| generate.image/video/voice | **mock via worker**, EXTERNAL_PAID blocked | IMPLEMENTED (mock) |
| compose_video | worker FFmpeg | IMPLEMENTED |

## Character / Prompt

| Item | Status |
|------|--------|
| Character API (`GET/POST …/characters`) | IMPLEMENTED, **not wired to DAG** |
| PromptVersion API | IMPLEMENTED, **not wired to graph planner** |
| Scene PATCH | IMPLEMENTED |

## Flags

```dotenv
OPENROUTER_ENABLED=false
OPENROUTER_ALLOW_PAID_REQUESTS=false
PROVIDER_LIVE_EXECUTION_ENABLED=false
AI_MOCK_MODE=true
```

**Real AI inference calls:** 0  
**Paid image/video/TTS:** 0  
**Production cutover:** NOT PERFORMED

## Verdict

**Phase 3 staging release: ACCEPTED** for mock-production E2E (API integration + Playwright desktop + worker delivery to MinIO).

**Remaining (non-blocking for staging mock):** full 22-case integration matrix, tool handler completeness audit with automated tests, Character/Prompt → DAG invalidation, Playwright mobile/tablet matrix.
