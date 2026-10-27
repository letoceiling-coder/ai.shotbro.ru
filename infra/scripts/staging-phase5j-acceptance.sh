#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG="${2:-/var/log/shotbro-e2e/phase5j-acceptance.log}"
DIR="$(dirname "$0")"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"

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

run_pw phase5-asset-library

for mode in regression-strict phase5-user-journey phase5-storyboard phase5-characters phase5-references phase5-creative-flow phase5-timeline phase5-assembly phase5-prompts phase5-providers; do
  run_pw "$mode"
done

echo "PHASE5J_ALL_PASS" | tee -a "$LOG"
