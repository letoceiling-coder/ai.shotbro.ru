# Secret rotation checklist (mandatory before production S3/OpenRouter use)

Previous exposure: chat, screenshots, terminal mask leak. **Treat pre-rotation keys as compromised.**

## Selectel S3

- [ ] Create new S3 key in Selectel panel (minimal scope on bucket `botsme`)
- [ ] Update `.env.production` on server only (`chmod 600`)
- [ ] Revoke key **Fran** / any key shared in chat
- [ ] Run `pnpm integrations:check -- --live` **only after** new keys are in place
- [ ] Confirm old key returns 403 within 15 minutes

## OpenRouter

- [ ] Revoke exposed key in OpenRouter dashboard
- [ ] Generate new key; store only in `.env.production`
- [ ] Keep `OPENROUTER_ENABLED=false` until Phase 3 approval

## Better Auth / app

- [ ] Set `BETTER_AUTH_SECRET` (32+ random bytes); rotate if ever committed
- [ ] Set unique `POSTGRES_PASSWORD` (not default `shotbro`)

## SMTP (when enabled)

- [ ] Use app password; rotate if exposed

## Verification (no secret output)

```bash
pnpm integrations:check -- --offline
# After rotation only:
pnpm integrations:check -- --live
```

Do **not** deploy production API with pre-rotation S3 credentials.
