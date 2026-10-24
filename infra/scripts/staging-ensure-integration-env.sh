#!/usr/bin/env bash
# Append missing integration keys to staging.env (never prints secret values).
set -euo pipefail
ENVF="${1:-/var/www/ai.shotbro.ru-src/infra/staging.env}"
ensure_kv() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENVF" 2>/dev/null; then
    return 0
  fi
  printf '%s=%s\n' "$key" "$val" >> "$ENVF"
}
ensure_kv INTEGRATION_PROVISION_ENABLED true
ensure_kv INTEGRATION_USER_A_EMAIL e2e-phase2@shotbro.test
ensure_kv INTEGRATION_USER_B_EMAIL e2e-phase2-b@shotbro.test
if ! grep -q '^INTEGRATION_PROVISION_SECRET=' "$ENVF"; then
  ensure_kv INTEGRATION_PROVISION_SECRET "$(openssl rand -base64 48 | tr -d '\n')"
fi
if ! grep -q '^INTEGRATION_USER_A_PASSWORD=' "$ENVF"; then
  ensure_kv INTEGRATION_USER_A_PASSWORD "${INTEGRATION_USER_A_PASSWORD:-TestPass123!}"
fi
if ! grep -q '^INTEGRATION_USER_B_PASSWORD=' "$ENVF"; then
  ensure_kv INTEGRATION_USER_B_PASSWORD "${INTEGRATION_USER_B_PASSWORD:-TestPass123!}"
fi
echo "integration env keys ensured (values not shown)"
