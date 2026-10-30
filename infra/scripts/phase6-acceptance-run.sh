#!/usr/bin/env bash
# Phase 6 acceptance (spec §10, 6F): talent UI + scene canvas + full chat scenario + regression-strict.
# Same lock as the 5L-B runner, so two acceptance runs never overlap. Prints PHASE6_ALL_PASS and EXIT_CODE.
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SHA="$(git -C "$ROOT" rev-parse --short=8 HEAD 2>/dev/null || echo unknown)"
LOGDIR="${LOGDIR:-/var/log/shotbro-e2e}"
LOG="${LOG:-${LOGDIR}/phase6-acceptance-${SHA}.log}"
LOCK="${LOCK:-/var/run/shotbro-phase5l-b-acceptance.lock}"

mkdir -p "$LOGDIR"
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "BLOCKED: another acceptance runner holds ${LOCK} ($(date -Is))" | tee -a "$LOG"
  exit 2
fi
if pgrep -f 'playwright test e2e/' >/dev/null 2>&1; then
  echo "BLOCKED: playwright test already running ($(date -Is))" | tee -a "$LOG"
  exit 2
fi

run() {
  local mode="$1"
  local log="${LOGDIR}/${mode}-${SHA}.log"
  echo "==> ${mode} -> ${log}"
  set +e
  bash "${ROOT}/infra/scripts/staging-playwright-e2e.sh" "$ROOT" "$mode" >"$log" 2>&1
  local ec=$?
  set -e
  grep -a -E "^\s+[0-9]+ (passed|failed|flaky|skipped)" "$log" | sed 's/^/  /' || true
  if [ "$ec" -ne 0 ]; then
    echo "FAIL mode=${mode} exit=${ec} sha=${SHA} $(date -Is)"
    return "$ec"
  fi
}

echo "PHASE6 acceptance run log=${LOG} sha=${SHA} $(date -Is)" | tee "$LOG"
set +e
(
  set -euo pipefail
  bash "${ROOT}/infra/scripts/phase5k-media-guard-smoke.sh" "$ROOT"
  run phase6-talent-ui
  run phase6-canvas
  run phase6-full
  run regression-strict
  echo "PHASE6_ALL_PASS sha=${SHA} $(date -Is)"
) 2>&1 | tee -a "$LOG"
EC="${PIPESTATUS[0]}"
set -e
echo "EXIT_CODE=${EC} sha=${SHA} $(date -Is)" | tee -a "$LOG"
exit "$EC"
