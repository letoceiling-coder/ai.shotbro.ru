# Phase 3 — Progress

**Started:** 2026-10-24  
**Baseline commit:** `e5c4045967e8a3b0b6f6d69ef0a452bb1b144d54`  
**Branch:** `phase3/agent` (after checkpoint)

Legend: **IMPLEMENTED** | **TESTED** | **DEPLOYED** | **BLOCKED** | **NOT IMPLEMENTED**

---

## Stage A — Audit

| Item | Status |
|------|--------|
| Repository audit | **IMPLEMENTED** — `PHASE3-AUDIT.md` |
| Architecture doc | **IMPLEMENTED** — `PHASE3-ARCHITECTURE.md` |
| Progress tracker | **IMPLEMENTED** — this file |
| Git checkpoint branch | **IMPLEMENTED** — `phase3/agent` |

---

## Stage B — Domain foundation

| Item | Status |
|------|--------|
| Env: AI_MOCK_MODE, PROVIDER_LIVE_EXECUTION_ENABLED | **IMPLEMENTED** |
| Execution policy guards | **IMPLEMENTED** — `@shotbro/config/ai-execution` |
| Production Zod contracts | **IMPLEMENTED** — `@shotbro/contracts/production` |
| Drizzle: production_document, graph, memory, agent state | **IMPLEMENTED** — migration `0001_third_tigra.sql` |
| State machine | **IMPLEMENTED** — `@shotbro/ai/state-machine` |
| Phase 3 unit tests (guards + SM) | **IMPLEMENTED** |

---

## Stage C — Core agent

| Item | Status |
|------|--------|
| Tool registry (TZ tools, side effects) | **PARTIAL** — `PHASE3_TOOLS` catalog; executor not wired |
| Agent run API | **IMPLEMENTED** — `POST/GET .../agent/runs` (mock pipeline) |
| Mock deterministic pipeline | **IMPLEMENTED** — brief → plan → script → storyboard docs + chat blocks |
| Context builder / project memory service | **NOT IMPLEMENTED** |
| Agent persistence loop | **NOT IMPLEMENTED** |

---

## Stage D — Creative pipeline

| Item | Status |
|------|--------|
| Brief builder | **NOT IMPLEMENTED** |
| Creative director | **NOT IMPLEMENTED** |
| Screenwriter + scenes | **NOT IMPLEMENTED** |
| Storyboard director | **NOT IMPLEMENTED** |
| Character continuity | **NOT IMPLEMENTED** |

---

## Stage E — Model & cost layer

| Item | Status |
|------|--------|
| Mock image/video/audio providers | **NOT IMPLEMENTED** |
| Model router strategies | **NOT IMPLEMENTED** |
| Cost reservation / budget ledger | **NOT IMPLEMENTED** |
| EXTERNAL_PAID hard block test (integration) | **NOT IMPLEMENTED** |

---

## Stage F — Production DAG

| Item | Status |
|------|--------|
| BullMQ graph orchestration | **NOT IMPLEMENTED** |
| Resume / cancel / selective regen | **NOT IMPLEMENTED** |

---

## Stage G — Media production

| Item | Status |
|------|--------|
| Prompt engine | **NOT IMPLEMENTED** |
| FFmpeg assembly | **NOT IMPLEMENTED** |
| Mock delivery MP4 | **NOT IMPLEMENTED** |

---

## Stage H — Frontend integration

| Item | Status |
|------|--------|
| REAL agent trigger from chat | **NOT IMPLEMENTED** |
| Production board | **NOT IMPLEMENTED** |
| REAL blocks without breaking DEMO | **NOT IMPLEMENTED** |

---

## Stage I — Testing

| Item | Status |
|------|--------|
| Unit | **PARTIAL** — Phase 2 + Phase 3 guards |
| Integration agent runs | **NOT IMPLEMENTED** |
| Playwright mock E2E | **NOT IMPLEMENTED** |
| Security cross-tenant agent | **NOT IMPLEMENTED** |

---

## Stage J — Staging deployment

| Item | Status |
|------|--------|
| Migrations on staging | **NOT IMPLEMENTED** |
| Mock E2E on VPS | **NOT IMPLEMENTED** |

---

## Flags confirmation (required at Phase 3 end)

| Flag | Current |
|------|---------|
| OPENROUTER_ENABLED | false (staging) |
| OPENROUTER_ALLOW_PAID_REQUESTS | false |
| PROVIDER_LIVE_EXECUTION_ENABLED | false (default in code) |
| AI_MOCK_MODE | true (default in code) |
| Real AI inference calls | 0 |

---

## Next actions

1. Run `pnpm db:generate` / migrate on dev DB  
2. Expand tool registry + mock pipeline through storyboard + approvals  
3. Agent module: wire EventLog + message blocks  
4. Integration + Playwright mock path  
