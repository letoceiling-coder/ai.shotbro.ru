# Phase 3 — Progress

**Branch:** `phase3/agent`  
**Commits:** `0288d45` (foundation), `bfb271d` (orchestrator/graph)  
**Baseline RC:** `e5c4045` / tag `phase2-rc1` (aligned — see `PHASE3-GIT-NOTES.md`)

Legend: **IMPLEMENTED** | **TESTED** | **DEPLOYED** | **BLOCKED** | **NOT IMPLEMENTED**

---

## Stage 0 — Git

| Item | Status |
|------|--------|
| Checkpoint commit | **IMPLEMENTED** `0288d45` |
| Orchestration commit | **IMPLEMENTED** `bfb271d` |
| Tag vs HEAD audit | **IMPLEMENTED** — `PHASE3-GIT-NOTES.md` |
| Secrets in diff | **TESTED** — none |

---

## Stage B — Domain foundation

| Item | Status |
|------|--------|
| Migration `0001_third_tigra` | **IMPLEMENTED** |
| Migration `0002_square_makkari` (finance, prompts, tool_execution cols) | **IMPLEMENTED** |
| Apply on dev PostgreSQL | **BLOCKED** locally — `DATABASE_URL` not set in agent env |
| ProductionDocument versioning (supersede) | **IMPLEMENTED** — `DrizzleProductionStorage` |
| ProjectMemory | **IMPLEMENTED** — API GET/PATCH |
| ProductionGraphNode | **IMPLEMENTED** — schema + service |
| AgentRun production states | **IMPLEMENTED** |
| ToolExecution persistence | **IMPLEMENTED** |
| PromptVersion | **IMPLEMENTED** — schema only |
| BudgetReservation + CostLedger | **IMPLEMENTED** — schema + `CostReservationService` |

---

## Stage C — Agent orchestrator

| Item | Status |
|------|--------|
| `ProductionOrchestrator` state machine | **IMPLEMENTED** — stops at approval gates |
| `ToolExecutor` + idempotency | **IMPLEMENTED** — handlers partial |
| Pause / resume / cancel API | **IMPLEMENTED** |
| Continue after approval | **IMPLEMENTED** — `POST .../runs/:id/resume` |
| Restore after API restart | **IMPLEMENTED** — state in PostgreSQL |
| EXTERNAL_PAID block | **TESTED** — unit 9/9 `@shotbro/ai` |

---

## Stage D — Creative production

| Item | Status |
|------|--------|
| BriefBuilder / CreativeDirector / Screenwriter / StoryboardDirector | **IMPLEMENTED** — deterministic mock |
| CharacterContinuityService | **NOT IMPLEMENTED** |
| Editable API for script/scenes | **NOT IMPLEMENTED** |

---

## Stage E — Model router & cost

| Item | Status |
|------|--------|
| Model strategies (mock router) | **IMPLEMENTED** |
| Mock cost estimate | **IMPLEMENTED** |
| Budget reservation (atomic tx) | **IMPLEMENTED** — unit/integration pending |
| Integration race test | **NOT IMPLEMENTED** |

---

## Stage F — Production DAG

| Item | Status |
|------|--------|
| Graph planner + cycle detection | **IMPLEMENTED** **TESTED** |
| Selective scene invalidation | **IMPLEMENTED** **TESTED** |
| Persist graph + BullMQ `production.node` | **PARTIAL** — enqueue API wired; orchestrator does not auto-enqueue yet |
| Worker execution | **IMPLEMENTED** — mock completion + ffmpeg probe |

---

## Stage G — Mock media & FFmpeg

| Item | Status |
|------|--------|
| Mock image/video/audio providers | **IMPLEMENTED** — lifecycle types |
| Fixture assets on S3 | **NOT IMPLEMENTED** |
| Full FFmpeg concat → MP4 asset | **NOT IMPLEMENTED** — worker probe only |
| Delivery document | **NOT IMPLEMENTED** |

---

## Stage H–J

| Stage | Status |
|-------|--------|
| H Frontend | **NOT IMPLEMENTED** |
| I Integration / Playwright | **NOT IMPLEMENTED** |
| J Staging deploy + migrate | **NOT IMPLEMENTED** |

---

## Tests (current)

| Suite | Result |
|-------|--------|
| `@shotbro/ai` unit | **9 passed** |
| API typecheck | **pass** |

---

## Flags

| Flag | Expected |
|------|----------|
| OPENROUTER_ENABLED | false |
| AI_MOCK_MODE | true (default) |
| PROVIDER_LIVE_EXECUTION_ENABLED | false (default) |
| Paid inference | **0** |

---

## Next (Stage H prep)

1. Apply `0001` + `0002` on dev/staging DB (`pnpm db:migrate`).  
2. Wire orchestrator `PRODUCING` → `ProductionGraphService.enqueueRunnable`.  
3. Hook approval UI → auto `resume` or document manual resume.  
4. Integration: agent run stops at plan approval; resume after approve.  
5. Local fixtures + S3 mock asset registration + FFmpeg concat.
