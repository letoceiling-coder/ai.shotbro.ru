#!/usr/bin/env bash
# Run Playwright against live staging (VPS). Sources credentials from staging.env.
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
ENVF="${ROOT}/infra/staging.env"
SPECS="${2:-e2e/phase4f-studio-audit.spec.ts e2e/phase3-mock-production.spec.ts e2e/phase4-unified-production.spec.ts}"

if [ ! -f "$ENVF" ]; then
  echo "missing $ENVF" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENVF"
set +a

export E2E_REAL_BACKEND=1
export E2E_STAGING_URL="${E2E_STAGING_URL:-https://ai.shotbro.ru}"
export E2E_TEST_EMAIL="${E2E_TEST_EMAIL:-${INTEGRATION_USER_A_EMAIL:-}}"
export E2E_TEST_PASSWORD="${E2E_TEST_PASSWORD:-${INTEGRATION_USER_A_PASSWORD:-}}"

if [ -z "$E2E_TEST_EMAIL" ] || [ -z "$E2E_TEST_PASSWORD" ]; then
  echo "E2E_TEST_EMAIL/PASSWORD or INTEGRATION_USER_A_* required in staging.env" >&2
  exit 1
fi

cd "$ROOT"
if [ ! -d node_modules ]; then
  pnpm config set verify-deps-before-run false
  pnpm config set strict-dep-builds false
  pnpm install
fi

cd "$ROOT/apps/web"
pnpm exec playwright install chromium --with-deps 2>/dev/null || pnpm exec playwright install chromium

# shellcheck disable=SC2086
pnpm exec playwright test $SPECS --project=desktop --project=desktop1440 --project=tablet --project=mobile
