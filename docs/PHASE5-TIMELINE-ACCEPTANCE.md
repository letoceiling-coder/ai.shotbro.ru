# Phase 5I — Timeline acceptance

| Gate | Status |
|------|--------|
| IMPLEMENTED | branch (schema, API, UI, worker) |
| PERSISTED | `production_document` TIMELINE v2 |
| WIRED | graph snapshot + worker assembly |
| VISIBLE | Creative Timeline tab |
| TESTED | `phase5-timeline` E2E (pending VPS run) |
| DEPLOYED | pending |

## Regression prerequisite

`regression-strict` **8/8** after Phase 4 reload fix (`pinRealProjectOnReload` + API asset poll).

## VPS commands

```bash
MODE=phase5-timeline infra/scripts/staging-playwright-e2e.sh
MODE=regression-strict infra/scripts/staging-playwright-e2e.sh
```

## Exit 137 note

Observed on long SSH docker builds — **OOMKilled=false** on web/api containers; likely client/session kill, not worker OOM. Monitor `dmesg` if builds fail mid-layer.
