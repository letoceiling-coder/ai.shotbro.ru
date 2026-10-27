# Phase 5K — Agent Integration acceptance

**Status:** **NOT ACCEPTED** (implementation in progress)

## Criteria checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | REAL chat drives creative tools | Implemented (`creative-turn` + routing); E2E pending |
| 2 | Real tool execution + DB | Implemented via delegates |
| 3 | Asset search / FIRST_FRAME | Implemented |
| 4 | Prompt versions | Implemented (`improve_scene_video_prompt`) |
| 5 | Model + cost proposal | Implemented (compare + estimate) |
| 6 | Timeline assign | Implemented |
| 7 | Deep links | Partial (store focus + section nav) |
| 8 | Approval integrity | Storyboard revise hook wired |
| 9 | IDOR | Reuses existing asset access |
| 10 | F5 persistence | E2E asserts |
| 11 | `phase5-agent-integration` PASS | Pending VPS run |
| 12 | Regression suites PASS | Pending |
| 13 | Mock-only / no paid AI | Policy unchanged |
| 14 | Docs + runtime SHAs | Partial |

## Commands

```bash
bash infra/scripts/staging-playwright-e2e.sh /var/www/ai.shotbro.ru-src phase5-agent-integration
```

Log path: `/var/log/shotbro-e2e/phase5-agent-integration-<sha>.log`

## Blockers

- Awaiting first green E2E on staging after API/web deploy.
