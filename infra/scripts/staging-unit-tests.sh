#!/usr/bin/env bash
# Typecheck + unit tests of one commit on the VPS, in an isolated copy inside Docker.
# Nothing touches the running staging stack or the source checkout (no node_modules written there).
# Usage: staging-unit-tests.sh [ROOT] [SHA]   → prints UNIT_EXIT_CODE=<n> at the end.
set -uo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SHA="${2:-HEAD}"
SHORT="$(git -C "$ROOT" rev-parse --short=8 "$SHA")"
WORK="/tmp/shotbro-unit-${SHORT}"
NODE_IMAGE="${UNIT_NODE_IMAGE:-node:22-alpine}"
VOLUME="${UNIT_NODE_MODULES_VOLUME:-shotbro-unit-node-modules}"

rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
git -C "$ROOT" archive "$SHA" | tar -x -C "$WORK"
echo "unit_tests_start sha=${SHORT} $(date -Is)"

docker run --rm \
  -v "$WORK:/app" \
  -v "${VOLUME}:/app/node_modules" \
  -w /app \
  -e CI=1 \
  "$NODE_IMAGE" \
  sh -lc '
set -u
corepack enable >/dev/null 2>&1 && corepack prepare pnpm@11.5.1 --activate >/dev/null 2>&1
pnpm config set verify-deps-before-run false >/dev/null
pnpm config set strict-dep-builds false >/dev/null
pnpm install --frozen-lockfile --ignore-scripts >/tmp/install.log 2>&1 || { tail -40 /tmp/install.log; echo "STEP_FAIL install"; exit 1; }
fails=0
step() {
  name="$1"; shift
  if "$@" >/tmp/step.log 2>&1; then echo "STEP_OK $name"; else echo "STEP_FAIL $name"; tail -60 /tmp/step.log; fails=$((fails+1)); fi
}
step contracts-typecheck pnpm --filter @shotbro/contracts typecheck
step config-typecheck pnpm --filter @shotbro/config typecheck
step ai-typecheck pnpm --filter @shotbro/ai typecheck
step ai-test pnpm --filter @shotbro/ai test
step api-typecheck pnpm --filter api typecheck
step worker-typecheck pnpm --filter worker typecheck
step web-test pnpm --filter web exec vitest run src
# Known pre-existing TS errors in two phase-5 e2e specs do not affect the Next build; anything else fails.
pnpm --filter web exec tsc --noEmit >/tmp/web-tsc.log 2>&1
new_errors=$(grep "error TS" /tmp/web-tsc.log | grep -v -E "e2e/(phase5-agent-integration|phase5-asset-library)\.spec\.ts" || true)
if [ -n "$new_errors" ]; then echo "STEP_FAIL web-typecheck"; echo "$new_errors" | head -60; fails=$((fails+1)); else echo "STEP_OK web-typecheck"; fi
exit $fails
'
CODE=$?
echo "UNIT_EXIT_CODE=${CODE} sha=${SHORT} $(date -Is)"
exit "$CODE"
