# Phase 5L-B — Workspace Coherence & Delivery UX

**Status:** IMPLEMENTED — **NOT ACCEPTED** (VPS unreachable 2026-10-29; acceptance blocked)  
**Git (origin):** **`c346eca`** (docs) · **acceptance target:** **`c089f793`** (+ runner script on next push)  
**Implementation baseline:** **`20539645`**  
**Last confirmed runtime (VPS SSH OK):** Web **`01c49cd2`** · API/Worker **`20539645`** · deploy **`c089f793`** **unverified** (build interrupted)

## VPS diagnostics (2026-10-29, agent environment)

| Check | Result | Notes |
|-------|--------|--------|
| SSH `root@85.117.235.93` (BatchMode, 25–40s) | **timeout** | Not proof of host power-off alone |
| HTTPS `https://ai.shotbro.ru/api/v1/health/live` | **504** (WebFetch) / **curl timeout** (local) | Edge or upstream down |
| TCP :22 from agent | **not confirmed** (Test-NetConnection slow) | Needs provider console / alternate path |

**Action:** restore host/network (provider panel, Caddy/Docker on VPS). **No** blind reboot/firewall changes from this recovery pass.

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

## VPS evidence (partial, before outage)

| Suite | Result |
|-------|--------|
| Idempotency + media guard | PASS |
| `regression-strict` | **8/8** @ `20539645` |
| `phase5-agent-integration` | **1/2** before `c089f793` |
| Full bundle | **exit 1** — `/var/log/shotbro-e2e/phase5l-b-acceptance-01c49cd2.log` |
| **`PHASE5L_B_ALL_PASS`** | **no** |

## Run acceptance (after SSH + health OK)

```bash
cd /var/www/ai.shotbro.ru-src
git fetch origin && git reset --hard c089f793c14dc03e6ea00146a4d874e139941f1c
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
