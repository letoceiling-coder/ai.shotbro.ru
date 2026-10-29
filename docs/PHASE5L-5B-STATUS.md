# Phase 5L-B — Workspace Coherence & Delivery UX

**Status:** IMPLEMENTED — **acceptance recovery in progress** (full green pending VPS run)  
**Implementation baseline:** **`20539645`**  
**Acceptance git (E2E + web fixes):** **`c089f793`**  
**Runtime (last confirmed VPS):** Web **`01c49cd2`** → deploy **`c089f793`** started (verify after SSH restore); API/Worker **`20539645`**

## Delivered (unchanged)

| ID | Item |
|----|------|
| **5L-4** | `invalidateCreativeProjectQueries` + hooks/SSE/approvals |
| **5L-5** | `creativeAutoNavigate`, settings toggle, `useAgentWorkspaceAutoNav` |
| **5L-6** | `shotbro-asset://` refs, video/audio preview API, chat + Production players |

## Acceptance recovery — RCA (2026-10-29)

| Issue | Root cause | Fix (commit) |
|-------|------------|--------------|
| `phase5-agent-integration` 2/2 smoke | NL asked for **2nd scene** with **1** script scene; tool card assertion flaky | `04e081f` search-only NL + API gate |
| `real-thread` missing after reload | **Sidebar race:** before Zustand rehydrate, `activeRealProjectId` defaulted to **first** project in list | `440240b` / `01c49cd` read persisted id from localStorage |
| Tool card not visible after API pass | Auto-nav on **storyboard** unmounts chat; reload opened **wrong** project | E2E: explicit `real-project-{id}` click (`c089f793`), chat tab, scroll |
| `resyncRealThreadFromApi` brittle | Same project-pin race + strict thread visibility | `660a8b4` hardened; prefer `gotoStudioSection` / explicit project click |

## VPS evidence (partial)

| Step | Result | Log |
|------|--------|-----|
| Idempotency smoke | PASS | (in bundle log) |
| Media guard | PASS | `PHASE5K_MEDIA_GUARD_PASS` |
| `regression-strict` | **8/8** @ `20539645` | `/var/log/shotbro-e2e/regression-strict-20539645.log` (prior run) |
| `phase5-agent-integration` | **1/2** until `c089f793` | `/var/log/shotbro-e2e/phase5-agent-integration-*.log` |
| Full `phase5l-b-acceptance-e2e.sh` | **exit 1** (agent smoke) | `/var/log/shotbro-e2e/phase5l-b-acceptance-01c49cd2.log` |
| **`PHASE5L_B_ALL_PASS`** | **not yet** | — |

## Run acceptance (when VPS reachable)

```bash
cd /var/www/ai.shotbro.ru-src
git fetch origin c089f793c14dc03e6ea00146a4d874e139941f1c
git reset --hard c089f793c14dc03e6ea00146a4d874e139941f1c
chmod +x infra/scripts/*.sh
bash infra/scripts/staging-deploy.sh --service web c089f79   # if web label != c089f793
bash infra/scripts/phase5l-b-acceptance-e2e.sh 2>&1 | tee /var/log/shotbro-e2e/phase5l-b-acceptance-c089f793.log
echo EXIT_CODE=$?
```

Require: **`PHASE5L_B_ALL_PASS`**, **exit 0**, sequential single runner.

## Mock policy

Unchanged: `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false`.

## Not in scope

**Phase 5L-C** not started. Do **not** declare full Phase 5L complete.
