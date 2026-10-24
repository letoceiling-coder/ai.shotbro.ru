#!/usr/bin/env bash
# Idempotent integration users A + B via localhost admin API (no public sign-up).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_DIR="${COMPOSE_DIR:-$ROOT/infra}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-shotbro-staging}"

ENABLED="$(grep -E '^INTEGRATION_PROVISION_ENABLED=' "$COMPOSE_DIR/staging.env" 2>/dev/null | cut -d= -f2- || true)"
if [[ "$ENABLED" != "true" ]]; then
  echo "INTEGRATION_PROVISION_ENABLED=true required in $COMPOSE_DIR/staging.env" >&2
  exit 1
fi

echo "== provision integration users (loopback inside API container) =="
exec bash "$ROOT/infra/scripts/run-provision-loopback.sh"
