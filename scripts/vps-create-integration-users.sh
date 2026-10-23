#!/usr/bin/env bash
# One-off: create fixed integration users A + B (requires ALLOW_PUBLIC_REGISTER=true briefly).
set -euo pipefail
API="${API:-http://127.0.0.1:3021}"
ORIGIN="${ORIGIN:-https://ai.shotbro.ru}"
PASS="${INTEGRATION_PASSWORD:-TestPass123!}"

create_user() {
  local email="$1"
  local name="$2"
  curl -sS -X POST "$API/api/auth/sign-up/email" \
    -H "Content-Type: application/json" \
    -H "Origin: $ORIGIN" \
    -d "{\"email\":\"$email\",\"password\":\"$PASS\",\"name\":\"$name\"}" || true
  echo
}

create_user "${E2E_EMAIL:-e2e-phase2@shotbro.test}" "E2E Phase2 A"
create_user "${INTEGRATION_USER_B_EMAIL:-e2e-phase2-b@shotbro.test}" "E2E Phase2 B"
