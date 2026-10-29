#!/usr/bin/env bash
# Run Phase 5L-B acceptance with flock, preflight, tee log, and reliable EXIT_CODE (SSH-safe).
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SHA="$(git -C "$ROOT" rev-parse --short=8 HEAD 2>/dev/null || echo unknown)"
LOGDIR="${LOGDIR:-/var/log/shotbro-e2e}"
LOG="${LOG:-${LOGDIR}/phase5l-b-acceptance-${SHA}.log}"
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

echo "PHASE5L-B acceptance run log=${LOG} sha=${SHA} $(date -Is)" | tee "$LOG"
set +e
(
  set -euo pipefail
  bash "${ROOT}/infra/scripts/phase5l-b-acceptance-e2e.sh" "$ROOT"
) 2>&1 | tee -a "$LOG"
EC="${PIPESTATUS[0]}"
set -e
echo "EXIT_CODE=${EC} sha=${SHA} $(date -Is)" | tee -a "$LOG"
exit "$EC"
