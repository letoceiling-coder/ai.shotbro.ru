#!/usr/bin/env bash
# Phase 5L-B acceptance: 5L-A baselines + unified studio E2E (sequential).
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SHA="$(git -C "$ROOT" rev-parse --short=8 HEAD 2>/dev/null || echo unknown)"
LOGDIR="${LOGDIR:-/var/log/shotbro-e2e}"

run() {
  local mode="$1"
  local log="${LOGDIR}/${mode}-${SHA}.log"
  echo "==> ${mode} -> ${log}"
  bash "${ROOT}/infra/scripts/staging-playwright-e2e.sh" "$ROOT" "$mode" 2>&1 | tee "$log"
}

echo "PHASE5L-B acceptance start sha=${SHA} $(date -Is)"

bash "${ROOT}/infra/scripts/phase5l-creative-idempotency-smoke.sh" "$ROOT"
bash "${ROOT}/infra/scripts/phase5k-media-guard-smoke.sh" "$ROOT"

run phase5-agent-integration
run regression-strict
run phase5-unified-studio

echo "PHASE5L_B_ALL_PASS sha=${SHA} $(date -Is)"
