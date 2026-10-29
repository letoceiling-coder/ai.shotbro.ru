# Phase 5L-B — Workspace Coherence & Delivery UX

**Status:** IMPLEMENTED — **NOT ACCEPTED**  
**Git (origin):** **`5ee205e`** · **web runtime:** **`c089f793`** · **API/Worker:** **`20539645`**

## Last acceptance run (2026-10-29, tmux `p5lba`)

| Check | Result |
|-------|--------|
| Log | `/var/log/shotbro-e2e/phase5l-b-acceptance-c089f793.log` |
| **`EXIT_CODE`** | **`1`** @ 13:35:43 UTC |
| **`PHASE5L_B_ALL_PASS`** | **no** |
| Idempotency + media guard | **PASS** |
| `phase5-agent-integration` | **2/2** |
| `regression-strict` | **6/8** — **mobile** phase3 + phase4 failed |
| `phase5-unified-studio` | **not reached** (blocked by regression) |

**RCA (mobile):** `resyncRealThreadFromApi` → `getByTestId('real-project-…').first()` matched **hidden** sidebar duplicate; fix **`5ee205e`** (`.filter({ visible: true })` + open «Проекты» / «Развернуть sidebar»).

**Next run:** upload E2E helpers to VPS (`real-ui-sync.ts` @ `5ee205e`), then **one** `phase5l-b-acceptance-run.sh` when no flock/tmux runner.

## Delivered (product)

| ID | Item |
|----|------|
| **5L-4** | `invalidateCreativeProjectQueries` + hooks/SSE/approvals |
| **5L-5** | `creativeAutoNavigate`, settings toggle, `useAgentWorkspaceAutoNav` |
| **5L-6** | `shotbro-asset://` refs, video/audio preview API, chat + Production players |

## Test / product RCA (pre-outage)

| Issue | Fix commit |
|-------|------------|
| Agent smoke NL vs 1 scene | `04e081f` |
| Sidebar wrong project after reload | `01c49cd` / `440240b` |
| Auto-nav hides chat in E2E | `c089f793` (`real-project-{id}`, chat tab) |

## Historical (pre-recovery)

| Suite | Result |
|-------|--------|
| `regression-strict` | **8/8** @ `20539645` (earlier) |
| Full bundle | **exit 1** — `phase5l-b-acceptance-01c49cd2.log` |

## Run acceptance (after SSH + health OK)

```bash
cd /var/www/ai.shotbro.ru-src
git fetch origin && git reset --hard ce3d2ff78876bfbfb5ed4f7dce7a60686d6b6b6a
chmod +x infra/scripts/*.sh
# Verify labels: docker inspect infra-web-1 ai-shotbro-staging-api-1 ai-shotbro-staging-worker-1
bash infra/scripts/staging-deploy.sh --service web c089f79   # if web != c089f793
bash infra/scripts/phase5l-b-acceptance-run.sh
# Log: /var/log/shotbro-e2e/phase5l-b-acceptance-<sha>.log — must end with EXIT_CODE=0 and PHASE5L_B_ALL_PASS
```

**Criteria:** agent-integration **2/2**, regression **8/8**, unified-studio **PASS**, smokes PASS, **exit 0**, mock media only.

## Mock policy

Unchanged: `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false`.

## Not in scope

**Phase 5L-C** not started until **5L-B ACCEPTED**.
