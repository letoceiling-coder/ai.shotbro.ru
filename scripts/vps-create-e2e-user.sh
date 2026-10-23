#!/usr/bin/env bash
# One-off: create Playwright E2E account (requires ALLOW_PUBLIC_REGISTER=true on API).
set -euo pipefail
API="${API:-http://127.0.0.1:3021}"
EMAIL="${E2E_EMAIL:-e2e-phase2@shotbro.test}"
PASS="${E2E_PASSWORD:-TestPass123!}"
curl -sS -X POST "$API/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -H "Origin: https://ai.shotbro.ru" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"E2E Phase2\"}"
echo
