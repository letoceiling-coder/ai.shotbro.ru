#!/usr/bin/env bash
# Phase 5L-A acceptance: 5K baselines + creative-turn idempotency (sequential, no parallel PW).
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

echo "PHASE5L-A acceptance start sha=${SHA} $(date -Is)"

IDEM_LOG="${LOGDIR}/phase5l-creative-idempotency-${SHA}.log"
echo "==> phase5l-creative-idempotency -> ${IDEM_LOG}"
bash "${ROOT}/infra/scripts/phase5l-creative-idempotency-smoke.sh" "$ROOT" 2>&1 | tee "$IDEM_LOG"

GUARD_LOG="${LOGDIR}/phase5k-media-guard-${SHA}.log"
echo "==> phase5k-media-guard -> ${GUARD_LOG}"
bash "${ROOT}/infra/scripts/phase5k-media-guard-smoke.sh" "$ROOT" 2>&1 | tee "$GUARD_LOG"

run phase5-agent-integration
run regression-strict

echo "PHASE5L_A_ALL_PASS sha=${SHA} $(date -Is)"
