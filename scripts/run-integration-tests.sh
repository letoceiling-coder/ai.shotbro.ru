#!/usr/bin/env bash
# Run on VPS (or against INTEGRATION_API_URL). Temporarily enables register if needed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/infra/staging.env"
API="${INTEGRATION_API_URL:-http://127.0.0.1:3021}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
export RUN_INTEGRATION_TESTS=1
export INTEGRATION_API_URL="$API"
export STAGING_GATE_SECRET="${STAGING_GATE_SECRET:-}"
cd "$ROOT"
pnpm --filter api test:integration
