# Phase 5 — Security report

**Last updated:** 2026-10-25 (5D–5F acceptance smoke)  
**Scope this update:** Creative Studio persistence surfaces — storyboard, characters, references — on staging only.

## Staging AI / provider posture

Verified on `ai-shotbro-staging-api-1` environment (values not reproduced here):

- `AI_MOCK_MODE=true`
- `PROVIDER_LIVE_EXECUTION_ENABLED=false`
- `OPENROUTER_ENABLED=false`
- `OPENROUTER_ALLOW_PAID_REQUESTS=false`

Per-provider live execution switches remain disabled. No paid live API verification performed during acceptance.

## 5D–5F controls exercised

| Area | Control |
|------|---------|
| Projects | Access policy on production routes |
| Assets | Project-scoped upload/list; signed URL delivery |
| Storyboard | Optimistic revision; **409** on stale PATCH (E2E) |
| Characters | Project memory; assign-scene versioning |
| References | `referenceLinks` scoped to project; detach unlinks, not shared blob delete |
| Cross-project | E2E isolation for references |
| Client bundle | No MinIO/root credentials observed in acceptance spot-check |
| Logs / E2E | No password or Magnific secret values in `/var/log/shotbro-e2e/*.log` samples |

## Magnific / third-party secrets

- `MAGNIFIC_API_KEY` and related webhook secret configured in server `staging.env` only.
- **ROTATION_REQUIRED** if these values were ever exposed outside the secret store (e.g. chat transcript). Do not validate keys via paid API calls in CI or acceptance.

## Full Phase 5 report

Broader authorization audit (timeline, prompt studio, delivery) remains **pending** until stages 5G–5P are implemented and tested. See `PHASE5-UI-ACCEPTANCE.md` for acceptance-time checklist.
