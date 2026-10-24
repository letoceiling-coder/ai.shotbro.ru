# Phase 4F — User-facing acceptance & stability

**Date:** 2026-10-25  
**Branch:** `phase4/intelligent-production`  
**Remote HEAD:** `3a7c978`

## Live runtime (VPS)

| Component | SHA / listener | Status |
|-----------|----------------|--------|
| Web | **`9c22914`** · `infra-web-1` @ `:3020` | verified (`staging-verify-web.sh`) |
| API / worker | **`4b127c7`** @ `:3021` | unchanged (no redeploy for delivery RCA) |
| systemd web | disabled | compose only |

## Delivery RCA

See **`docs/PHASE4F-DELIVERY-ROOT-CAUSE.md`**. Summary: failed runs stopped at **SCRIPT PENDING** (approvals incomplete); worker/MinIO never involved. Fixed E2E approval gate synchronization (`3a7c978`).

## Playwright strict (retries=0, workers=1)

| Run | Log | Result |
|-----|-----|--------|
| `regression-strict` @ `3a7c978` | `/tmp/regression-strict-3a7c978.log` | **8/8 PASS FIRST ATTEMPT** (4.1m) |

| Suite | desktop | desktop1440 | tablet | mobile |
|-------|---------|-------------|--------|--------|
| Phase 3 mock | PASS ~8s | PASS ~9s | PASS ~8s | PASS ~8s |
| Phase 4 unified | PASS ~1.2m | PASS ~1.1m | PASS ~1.1m | PASS ~8s |

Phase 3 smoke proof project: `4822ccf8-…` · run **COMPLETED** · `mock-delivery` asset · all approvals APPROVED.

## Policy

`AI_MOCK_MODE=true` · no paid AI · **production cutover NOT PERFORMED**

## Sign-off

| Criterion | Status |
|-----------|--------|
| REAL create + composer | PASS |
| Mock production → MP4 asset | PASS (DB + E2E) |
| Deploy SHA = running web | PASS |
| **8/8 strict Playwright** | **PASS** |
