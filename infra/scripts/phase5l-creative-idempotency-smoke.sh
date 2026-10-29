#!/usr/bin/env bash
# Phase 5L-A: creative-turn HTTP idempotency against staging API (mock LLM path).
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
ENVF="${ROOT}/infra/staging.env"
PW_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-jammy}"
PW_NODE_VOLUME="${PLAYWRIGHT_NODE_MODULES_VOLUME:-shotbro-e2e-node-modules}"

env_val() {
  grep -E "^${1}=" "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'
}

export RUN_INTEGRATION_TESTS=1
export INTEGRATION_API_URL="${INTEGRATION_API_URL:-https://ai.shotbro.ru}"
export INTEGRATION_ORIGIN="${INTEGRATION_ORIGIN:-https://ai.shotbro.ru}"
export STAGING_GATE_SECRET="$(env_val STAGING_GATE_SECRET)"
export INTEGRATION_USER_A_EMAIL="$(env_val INTEGRATION_USER_A_EMAIL)"
export INTEGRATION_USER_A_PASSWORD="$(env_val INTEGRATION_USER_A_PASSWORD)"
export E2E_TEST_EMAIL="$(env_val E2E_TEST_EMAIL)"
export E2E_TEST_PASSWORD="$(env_val E2E_TEST_PASSWORD)"
export INTEGRATION_USER_A_EMAIL="${INTEGRATION_USER_A_EMAIL:-$E2E_TEST_EMAIL}"
export INTEGRATION_USER_A_PASSWORD="${INTEGRATION_USER_A_PASSWORD:-$E2E_TEST_PASSWORD}"

docker run --rm \
  -v "$ROOT:/app" \
  -v "${PW_NODE_VOLUME}:/app/node_modules" \
  -w /app \
  -e RUN_INTEGRATION_TESTS=1 \
  -e INTEGRATION_API_URL \
  -e INTEGRATION_ORIGIN \
  -e STAGING_GATE_SECRET \
  -e INTEGRATION_USER_A_EMAIL \
  -e INTEGRATION_USER_A_PASSWORD \
  -e CI=1 \
  "$PW_IMAGE" \
  bash -lc 'set -euo pipefail
corepack enable && corepack prepare pnpm@11.5.1 --activate
pnpm config set verify-deps-before-run false
if [ ! -f node_modules/.modules.yaml ]; then pnpm install --frozen-lockfile; fi
pnpm --filter api exec vitest run test/integration/phase5l-creative-idempotency.integration.spec.ts
echo PHASE5L_CREATIVE_IDEMPOTENCY_SMOKE_PASS'
