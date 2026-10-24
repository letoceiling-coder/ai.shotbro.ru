# Phase 3 — Release Candidate acceptance

**Branch:** `phase3/agent`  
**Git HEAD:** `66c1d2f` — **pushed** to `git@github.com:letoceiling-coder/ai.shotbro.ru.git`  
**Staging runtime deploy:** `66c1d2f` (`DEPLOYED.txt` on VPS)  
**Tag phase3-rc1:** **pending** (mobile Playwright fail)  

## Staging consistency

| Check | Result |
|-------|--------|
| VPS `DEPLOYED.txt` | `42fb413` |
| Repo vs VPS | API/worker/web aligned at `42fb413`; e2e helper may be ahead until next web-less commit only |
| API image | `sha256:1ce0e91bf37b52ee87b2aa0b490be1b8e70425f31a45124623c0a9604ab064e2` |
| Worker image | `sha256:0b9de40b930b8a6bdf74c7f974ec663cf35c5a20dc78ea13a3eb20128e29d592` |
| Web image | `sha256:8cf6dbec4b5ff8b7e6984337bab0bf2b48ae813b277df9191e1f5ce5c9bfebcc` |
| Mock flags in API container | `OPENROUTER_ENABLED=false` (verified) |

## Phase 2 regression (integration @ staging)

`RUN_INTEGRATION_TESTS=1` + `INTEGRATION_API_URL=https://ai.shotbro.ru`

| Suite | Pass | Fail | Skip |
|-------|------|------|------|
| approval-flow | 4 | 0 | 0 |
| approval-cross-tenant | 1 | 0 | 0 |
| security-isolation | 9 | 0 | 0 |
| upload-flow | 1 | 0 | 0 |
| upload-idor | 3 | 0 | 0 |
| sse-replay | 1 | 0 | 0 |
| **Total Phase 2** | **19** | **0** | **0** |

## Phase 3 integration (staging)

| Suite | Pass | Fail |
|-------|------|------|
| phase3-full-agent (E2E agent + MinIO MP4) | 2 | 0 |
| agent-production (idempotency) | 1 | 0 |
| phase3-rc (guards + budget + cross-tenant) | 3 | 0 |
| **Total Phase 3** | **6** | **0** |

**Not covered in automated matrix:** budget race, worker crash recovery, DAG enqueue idempotency under concurrency (manual/code review only).

## Playwright (`phase3-mock-production.spec.ts`)

| Project | Result |
|---------|--------|
| desktop | **pass** |
| desktop1440 | **pass** |
| tablet | **pass** |
| mobile | **pass** (after opening «Проекты» sheet in e2e helper) |

## Character / Prompt → DAG

| Item | Status |
|------|--------|
| `sceneGraphVersionHash` (prompt + character + scene revision) | **IMPLEMENTED** + unit test |
| Selective `invalidateSceneDependents` | **IMPLEMENTED** (existing planner) |
| API: scene patch / prompt create / character upsert → invalidate nodes | **IMPLEMENTED** in `42fb413` |
| **TESTED on staging** | unit + code path; no dedicated invalidation integration test yet |

## Tool Executor

See [PHASE3-TOOL-EXECUTOR-MATRIX.md](./PHASE3-TOOL-EXECUTOR-MATRIX.md). Mock production path via orchestrator + worker; **no full ToolExecutor handler registry**.

## Flags & billing

```dotenv
OPENROUTER_ENABLED=false
OPENROUTER_ALLOW_PAID_REQUESTS=false
PROVIDER_LIVE_EXECUTION_ENABLED=false
AI_MOCK_MODE=true
```

**Real AI inference calls:** 0  
**Paid image/video/audio generations:** 0  
**Production cutover:** NOT PERFORMED  

## RC verdict

**ACCEPTED (staging mock-production RC)** at deploy **`42fb413`**.

**Remaining before tag `phase3-rc1`:** configure git `origin` and push; deploy RC hardening (see below); provision User B; full regression after deploy.

---

## RC hardening + GitHub (2026-10-24)

**Полный отчёт:** [PHASE3-RC-HARDENING.md](./PHASE3-RC-HARDENING.md)

| Area | Result |
|------|--------|
| GitHub origin + history | **DONE** — `phase2/backend`, `phase3/agent`, tag `phase2-rc1` |
| Migration 0004 | **APPLIED** on staging |
| Integration users A/B | **TESTED** — provision + sign-in 200 |
| API integration @ staging | **31 pass**, 3 skip (DB) |
| Playwright desktop mock E2E | **pass** |
| Playwright mobile | **1 fail** — blocks `phase3-rc1` tag |
