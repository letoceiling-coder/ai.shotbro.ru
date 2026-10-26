#!/usr/bin/env bash
# Phase 5I final Playwright acceptance (retries=0). Run on VPS after FFmpeg matrix PASS.
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG="${2:-/var/log/shotbro-e2e/phase5i-acceptance.log}"
DIR="$(dirname "$0")"
mkdir -p "$(dirname "$LOG")"
: >"$LOG"

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
  {
    echo "===== $mode ====="
    bash "$DIR/staging-playwright-e2e.sh" "$ROOT" "$mode"
    echo "PASS $mode"
  } >>"$LOG" 2>&1 || {
    echo "FAIL $mode" >>"$LOG"
    tail -60 "$LOG" >&2
    exit 1
  }
done
echo "ALL_PASS" >>"$LOG"
cat "$LOG" | tail -20
