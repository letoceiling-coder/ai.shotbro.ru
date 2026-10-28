#!/usr/bin/env bash
# Sequential Phase 5K acceptance Playwright suites (retries=0), VPS only.
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
LOG_DIR="${2:-/var/log/shotbro-e2e}"
SHA="$(cd "$ROOT" && git rev-parse --short HEAD)"
LOG="${LOG_DIR}/phase5k-acceptance-${SHA}.log"
mkdir -p "$LOG_DIR"

exec > >(tee -a "$LOG") 2>&1
echo "phase5k_acceptance_start sha=${SHA} $(date -Is)"

run() {
  echo "--- mode=$1 ---"
  bash "$ROOT/infra/scripts/staging-playwright-e2e.sh" "$ROOT" "$1"
}

run phase5-agent-integration
run regression-strict
run phase5-user-journey
run phase5-asset-library
run phase5-storyboard
run phase5-characters
run phase5-references
run phase5-creative-flow
run phase5-prompts
run phase5-providers
run phase5-timeline
run phase5-assembly

echo "PHASE5K_ALL_PASS sha=${SHA} $(date -Is)"
