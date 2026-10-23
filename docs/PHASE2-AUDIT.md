# Phase 2 — preliminary audit

Date: 2026-10-23

## Monorepo layout

| Path | State | Notes |
|------|--------|--------|
| `apps/web` | **Production UI** | Next.js 16, assistant-ui, Zustand, 4 DEMO projects, Playwright e2e |
| `apps/api` | **Stub** | `build` echoes "Phase 2" |
| `apps/worker` | **Stub** | Placeholder |
| `packages/contracts` | **Ready** | Zod blocks, demo scenarios, events, status enums |
| `packages/agent-core` | **Stub** | Tool IDs, demo registry, no LLM |
| `packages/provider-sdk` | **Stub** | TypeScript shell |
| `packages/config` | **Ready** | Env, S3 client, OpenRouter config (disabled), SMTP types |
| `packages/email` | **Ready** | Templates, nodemailer transport (EMAIL_ENABLED=false) |
| `packages/ui` | **Minimal** | Shared UI placeholder |
| `infra/` | **Partial** | Docker web only on VPS :3020, nginx example, `.env.production` on server (not in Git) |

## Git

- Repository initialized locally; **no commits** at audit start (untracked tree).
- Rollback: tag `phase1-ui-checkpoint` after initial commit.

## DEMO runtime

- **Storage:** `zustand` + `persist` key `shotbro-studio-demo-v1`.
- **Projects:** `createInitialDemoProjects()` — ad, avatar, cartoon, photo (`demo: true`).
- **Ad flow:** `adStages` map + `getAdMessages(stage)` + `handleApproval` mutates messages client-side.
- **New user projects:** created with `demo: true`, empty messages (photo scenario).
- **Attachments:** blob URLs from `File[]` in composer; demo assets under `/demo-assets/`.

## Chat & blocks

- Messages typed via `@shotbro/contracts` `ChatMessage` + discriminated `MessageBlock` union.
- Rendered by `message-block-renderer.tsx` — **reuse as-is** for REAL payloads from API.
- No trusted HTML from models; structured JSON blocks only.

## UI components (keep unchanged)

- `studio-shell`, sidebar, header, demo banner, composer, cards, context panel, themes.

## Integrations (Phase 2 prep)

- Selectel S3 env in `.env.production` (local, gitignored); live check passed previously.
- OpenRouter: key may exist, **ENABLED=false**, no API calls.
- SMTP: **not configured**; email verification cannot send until SMTP filled.

## Production server (85.117.235.93)

- `https://ai.shotbro.ru/studio` — Docker `infra-web-1`, port 127.0.0.1:3020.
- **Do not** remove other containers or touch `studio.shotbro.ru`.

## Gaps to close in Phase 2

1. PostgreSQL + Drizzle schema & migrations  
2. NestJS API `/api/v1/*` + Better Auth  
3. Redis + BullMQ worker (media metadata, cleanup)  
4. S3 upload init/complete, presigned, multipart  
5. REAL projects/messages/approvals/events in DB  
6. SSE + event log  
7. UI: TanStack Query + auth; DEMO mode isolated  
8. Docker: postgres, redis, api, worker; nginx `/api` proxy  
9. Tests: unit, integration (IDOR), e2e REAL flows  
10. Fix local `pnpm lint` (corrupted transitive deps)

## Risks

- `ProjectSchema` requires `demo: true` — extend contracts for REAL without breaking DEMO.  
- Better Auth + Nest: use **Express** adapter if Fastify integration unstable.  
- Selectel CORS may need panel config for browser PUT to S3.  
- VPS RAM limits concurrent FFmpeg workers.

## Reuse without rewrite

- All `apps/web/src/components/chat/blocks/*`  
- `demo-thread.tsx` for DEMO mode only  
- `@shotbro/contracts` block schemas as API payload validation  
- `@shotbro/config/s3` storage adapter base
