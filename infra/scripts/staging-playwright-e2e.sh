#!/usr/bin/env bash
# Run Playwright against live staging (VPS). Credentials from staging.env (never printed).
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
ENVF="${ROOT}/infra/staging.env"
MODE="${2:-full}"
# Must match pnpm-lock @playwright/test (currently 1.64.1).
PW_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v1.64.1-jammy}"

if [ ! -f "$ENVF" ]; then
  echo "missing $ENVF" >&2
  exit 1
fi

env_val() {
  grep -E "^${1}=" "$ENVF" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'
}

export E2E_REAL_BACKEND=1
export E2E_STAGING_URL="$(env_val E2E_STAGING_URL)"
export E2E_STAGING_URL="${E2E_STAGING_URL:-https://ai.shotbro.ru}"
export E2E_TEST_EMAIL="$(env_val E2E_TEST_EMAIL)"
export E2E_TEST_PASSWORD="$(env_val E2E_TEST_PASSWORD)"
if [ -z "$E2E_TEST_EMAIL" ]; then
  E2E_TEST_EMAIL="$(env_val INTEGRATION_USER_A_EMAIL)"
  export E2E_TEST_EMAIL
fi
if [ -z "$E2E_TEST_PASSWORD" ]; then
  E2E_TEST_PASSWORD="$(env_val INTEGRATION_USER_A_PASSWORD)"
  export E2E_TEST_PASSWORD
fi

if [ -z "$E2E_TEST_EMAIL" ] || [ -z "$E2E_TEST_PASSWORD" ]; then
  echo "E2E_TEST_EMAIL/PASSWORD or INTEGRATION_USER_A_* required in staging.env" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker required for Playwright on VPS (host Node/pnpm is unsupported)" >&2
  exit 1
fi

docker run --rm \
  -v "$ROOT:/app" \
  -w /app \
  -e E2E_REAL_BACKEND=1 \
  -e E2E_STAGING_URL \
  -e E2E_TEST_EMAIL \
  -e E2E_TEST_PASSWORD \
  -e CI=1 \
  "$PW_IMAGE" \
  bash -lc "set -euo pipefail
corepack enable && corepack prepare pnpm@11.5.1 --activate
pnpm config set verify-deps-before-run false
pnpm config set strict-dep-builds false
if [ ! -d node_modules ]; then pnpm install; fi
cd apps/web
if [ \"${MODE}\" = audit ]; then
  pnpm exec playwright test e2e/phase4f-studio-audit.spec.ts --project=desktop
elif [ \"${MODE}\" = phase5-audit ]; then
  pnpm exec playwright test e2e/phase5-baseline-audit.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile
elif [ \"${MODE}\" = phase5-providers ]; then
  pnpm exec playwright test e2e/phase5-providers-routing.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile --retries=0
elif [ \"${MODE}\" = phase5-storyboard ]; then
  pnpm exec playwright test e2e/phase5-storyboard.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile --retries=0
elif [ \"${MODE}\" = phase5-characters ]; then
  pnpm exec playwright test e2e/phase5-characters.spec.ts --project=desktop --project=mobile --retries=0
elif [ \"${MODE}\" = phase5-references ]; then
  pnpm exec playwright test e2e/phase5-references.spec.ts --project=desktop1440 --project=tablet --project=mobile --retries=0
elif [ \"${MODE}\" = phase5-creative ]; then
  pnpm exec playwright test e2e/phase5-storyboard.spec.ts e2e/phase5-characters.spec.ts e2e/phase5-references.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile --retries=0
elif [ \"${MODE}\" = diagnostic ]; then
  export E2E_DIAG_DIR=/tmp/phase4f-composer-diag
  rm -rf \"\$E2E_DIAG_DIR\"
  pnpm exec playwright test e2e/phase4f-real-composer-diagnostic.spec.ts --project=desktop --trace on
elif [ \"${MODE}\" = regression-strict ]; then
  export E2E_STRICT=1
  pnpm exec playwright test e2e/phase3-mock-production.spec.ts e2e/phase4-unified-production.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile --retries=0
elif [ \"${MODE}\" = phase3-desktop-strict ]; then
  export E2E_STRICT=1
  pnpm exec playwright test e2e/phase3-mock-production.spec.ts --project=desktop --retries=0
elif [ \"${MODE}\" = regression ]; then
  pnpm exec playwright test e2e/phase3-mock-production.spec.ts e2e/phase4-unified-production.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile
else
  set +e
  pnpm exec playwright test e2e/phase4f-studio-audit.spec.ts --project=desktop
  F4=\$?
  pnpm exec playwright test e2e/phase3-mock-production.spec.ts e2e/phase4-unified-production.spec.ts --project=desktop --project=desktop1440 --project=tablet --project=mobile
  F34=\$?
  exit \$(( F4 != 0 ? F4 : F34 ))
fi"
