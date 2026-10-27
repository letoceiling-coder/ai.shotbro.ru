#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG="${2:-/var/log/shotbro-e2e/phase5i-signoff-suites.log}"
DIR="$(dirname "$0")"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"
rm -f "$ROOT/apps/web/e2e/.auth/real-user.json"
modes=(
  phase5-characters
  phase5-references
  phase5-creative-flow
  phase5-prompts
  phase5-providers
  phase5-timeline
  phase5-assembly
)
for mode in "${modes[@]}"; do
  echo "===== $mode =====" | tee -a "$LOG"
  if bash "$DIR/staging-playwright-e2e.sh" "$ROOT" "$mode" >>"$LOG" 2>&1; then
    echo "PASS $mode exit=0" | tee -a "$LOG"
  else
    ec=$?
    echo "FAIL $mode exit=$ec" | tee -a "$LOG"
    exit "$ec"
  fi
done
echo "ALL_PASS" | tee -a "$LOG"
