# Phase 4F — User-facing acceptance

**Status:** pending server deploy + Playwright on VPS

## Target UX (REAL)

- [ ] Studio shows REAL badge, project title from server
- [ ] New project dialog with production templates
- [ ] Right context panel: Production / Assets / Models
- [ ] Agent run strip with step labels
- [ ] Model selector in composer (economy/balance/quality/manual)
- [ ] Mock policy visible; no live generation controls

## Deploy

| Field | Value |
|-------|-------|
| Git | TBD after push |
| Staging | TBD |

## Tests (VPS only)

- `phase4f-studio-audit.spec.ts` — screenshots 4 viewports
- `phase3-mock-production.spec.ts` / `phase4-unified-production.spec.ts` — regression

## Policy

`AI_MOCK_MODE=true` · no paid provider calls · no production cutover
