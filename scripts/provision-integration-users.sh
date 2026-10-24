#!/usr/bin/env bash
# Idempotent integration users A + B via localhost admin API (no public sign-up).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/infra/staging.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

COMPOSE_DIR="${COMPOSE_DIR:-$ROOT/infra}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-ai-shotbro-staging}"

if [[ "${INTEGRATION_PROVISION_ENABLED:-}" != "true" ]]; then
  echo "INTEGRATION_PROVISION_ENABLED=true required in staging.env" >&2
  exit 1
fi

echo "== provision integration users (API container CLI) =="
(
  cd "$COMPOSE_DIR"
  docker compose --env-file staging.env -f "$COMPOSE_FILE" exec -T api \
    pnpm exec tsx apps/api/scripts/provision-integration-users-cli.ts
)
echo
