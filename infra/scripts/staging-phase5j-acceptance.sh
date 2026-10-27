#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG="${2:-/var/log/shotbro-e2e/phase5j-acceptance.log}"
# Optional: PHASE5J_START_AT=phase5-user-journey skips earlier suites (asset-library must already be green).
START_AT="${PHASE5J_START_AT:-}"
DIR="$(dirname "$0")"
mkdir -p "$(dirname "$LOG")"
if [ -z "$START_AT" ]; then
  : >"$LOG"
fi

run_pw() {
  local mode="$1"
  echo "===== $mode =====" | tee -a "$LOG"
  if bash "$DIR/staging-playwright-e2e.sh" "$ROOT" "$mode" >>"$LOG" 2>&1; then
    echo "PASS $mode exit=0" | tee -a "$LOG"
  else
    ec=$?
    echo "FAIL $mode exit=$ec" | tee -a "$LOG"
    exit "$ec"
  fi
}

skip=0
if [ -n "$START_AT" ]; then skip=1; fi

for mode in phase5-asset-library regression-strict phase5-user-journey phase5-storyboard phase5-characters phase5-references phase5-creative-flow phase5-timeline phase5-assembly phase5-prompts phase5-providers; do
  if [ "$skip" -eq 1 ]; then
    if [ "$mode" = "$START_AT" ]; then skip=0; else
      echo "SKIP $mode (PHASE5J_START_AT=$START_AT)" | tee -a "$LOG"
      continue
    fi
  fi
  run_pw "$mode"
done

echo "PHASE5J_ALL_PASS" | tee -a "$LOG"
