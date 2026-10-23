# PostgreSQL backup & restore (Phase 2)

## Backup (production)

```bash
docker exec -t infra-postgres-1 pg_dump -U shotbro -Fc shotbro > shotbro-$(date +%F).dump
```

Store dumps off-server. Never commit dumps to Git.

## Restore (staging only)

```bash
pg_restore -U shotbro -d shotbro --clean --if-exists shotbro-YYYY-MM-DD.dump
```

Verify with `pnpm integrations:check -- --offline` and API `/api/v1/health/ready`.

## Migration policy

1. Change Drizzle schema in Git.  
2. `pnpm db:generate` → review SQL in `packages/db/drizzle/migrations/`.  
3. Apply on staging.  
4. Backup production.  
5. Apply migration with privileged DB role.  
6. Roll forward only — no auto-migrate on API boot.
