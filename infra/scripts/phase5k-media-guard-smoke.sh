#!/usr/bin/env bash
# Phase 5K negative checks: media guards + provider policy (no paid media calls).
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
PW_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-jammy}"
PW_NODE_VOLUME="${PLAYWRIGHT_NODE_MODULES_VOLUME:-shotbro-e2e-node-modules}"

docker run --rm \
  -v "$ROOT:/app" \
  -v "${PW_NODE_VOLUME}:/app/node_modules" \
  -w /app \
  -e CI=1 \
  "$PW_IMAGE" \
  bash -lc 'set -euo pipefail
corepack enable && corepack prepare pnpm@11.5.1 --activate
pnpm config set verify-deps-before-run false
if [ ! -f node_modules/.modules.yaml ]; then pnpm install --frozen-lockfile; fi
pnpm --filter api exec vitest run test/unit/phase5k-media-guard.spec.ts
pnpm --filter api exec vitest run test/integration/phase3-rc.integration.spec.ts -t "EXTERNAL_PAID"
echo PHASE5K_MEDIA_GUARD_PASS'
