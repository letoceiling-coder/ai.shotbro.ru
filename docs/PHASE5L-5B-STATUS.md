# Phase 5L-B — Workspace Coherence & Delivery UX

**Status:** **ACCEPTED** (2026-10-29)  
**Git (origin):** **`74324c7`** · **web runtime:** **`74324c74`** · **API/Worker:** **`20539645`**

## Acceptance run (2026-10-29, tmux `p5lba`, flock runner)

| Check | Result |
|-------|--------|
| Log | `/var/log/shotbro-e2e/phase5l-b-acceptance-74324c74.log` |
| **`EXIT_CODE`** | **`0`** @ 21:50:58 UTC |
| **`PHASE5L_B_ALL_PASS`** | **yes** — `sha=74324c74` |
| Creative idempotency smoke | **PASS** |
| Media guard smoke | **PASS** |
| `phase5-agent-integration` | **2/2** |
| `regression-strict` | **8/8** (desktop, desktop1440, tablet, mobile) |
| `phase5-unified-studio` | **3/3** |

Targeted pre-check: `phase5-unified-studio-74324c74-targeted.log` — 3/3, exit 0.  
Mock policy verified in `staging.env` and API container before the run.

## Final RCA (run `018e063b`, exit 1)

Unified test failed: `real-thread` not found after returning to chat; UI showed Assets with «Библиотека пуста».

| Bug | Cause | Fix (`74324c7`) |
|-----|-------|-----------------|
| Auto-nav replays history | `seen` was a per-mount `useRef`; `RealThread` unmounts outside chat, so F5 or clicking «AI Chat» replayed every old tool `deepLink` and bounced the user away | `lib/agent-auto-nav.ts`: results created before page load are history; module-level seen set; one navigation per batch, mutating tools preferred over lookups; unit tests |
| Asset library empty with READY assets | Filter-reset effect ran on mount and wiped items served from React Query cache | Items tagged by filter key; next pages dedupe by id |

E2E hardened (no assertions weakened): strict `asset-card-{id}` visible after upload; F5 on chat and chat-tab return must stay on chat.

`6d49bad` (SSE `message.created` → invalidate `["messages", conversationId]`) is included in the accepted web build.

## Delivered (product)

| ID | Item |
|----|------|
| **5L-4** | `invalidateCreativeProjectQueries` + hooks/SSE/approvals |
| **5L-5** | `creativeAutoNavigate`, settings toggle, `useAgentWorkspaceAutoNav` |
| **5L-6** | `shotbro-asset://` refs, video/audio preview API, chat + Production players |

## Earlier test / product RCA

| Issue | Fix commit |
|-------|------------|
| Agent smoke NL vs 1 scene | `04e081f` |
| Sidebar wrong project after reload | `01c49cd` / `440240b` |
| Mobile regression: hidden sidebar duplicate | `5ee205e` |
| Auto-nav seen before navigation | `3717063` |

## Rerun acceptance

```bash
cd /var/www/ai.shotbro.ru-src && git pull --ff-only
# check no runner: fuser /var/run/shotbro-phase5l-b-acceptance.lock; pgrep -af '[p]laywright test e2e/'
tmux new-session -d -s p5lba 'bash /var/www/ai.shotbro.ru-src/infra/scripts/phase5l-b-acceptance-run.sh'
# Log: /var/log/shotbro-e2e/phase5l-b-acceptance-<sha>.log — EXIT_CODE=0 and PHASE5L_B_ALL_PASS
```

## Mock policy

Unchanged: `AI_MOCK_MODE=true`, `PROVIDER_LIVE_EXECUTION_ENABLED=false`, `MEDIA_GENERATION_ENABLED=false`.

## Next

**Phase 5L-C** (full `PHASE5L_ALL_PASS`, scene job gallery, brief smoke) — not started; needs a separate go-ahead.
