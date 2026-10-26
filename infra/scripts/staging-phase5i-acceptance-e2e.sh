#!/usr/bin/env bash
# Phase 5I final Playwright acceptance (retries=0). Run on VPS after FFmpeg matrix PASS.
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG="${2:-/var/log/shotbro-e2e/phase5i-acceptance.log}"
DIR="$(dirname "$0")"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"
rm -f "$ROOT/apps/web/e2e/.auth/real-user.json"

modes=(
  phase5-timeline
  phase5-assembly
  regression-strict
  phase5-prompts
  phase5-providers
  phase5-storyboard
  phase5-characters
  phase5-references
  phase5-creative-flow
)

for mode in "${modes[@]}"; do
  echo "===== $mode =====" >>"$LOG"
  if bash "$DIR/staging-playwright-e2e.sh" "$ROOT" "$mode" >>"$LOG" 2>&1; then
    echo "PASS $mode" >>"$LOG"
  else
    echo "FAIL $mode (exit $?)" >>"$LOG"
    tail -60 "$LOG" >&2
    exit 1
  fi
done
echo "ALL_PASS" >>"$LOG"
cat "$LOG" | tail -20
