#!/usr/bin/env bash
# Typecheck + unit tests of one commit on the VPS, in an isolated copy inside Docker.
# Nothing touches the running staging stack or the source checkout (no node_modules written there).
# Usage: staging-unit-tests.sh [ROOT] [SHA] [BASE]   → prints UNIT_EXIT_CODE=<n> at the end.
#
# Gate: all unit tests (ai, web) + typecheck errors of contracts/api/web located in files changed
# between BASE (default SHA~1) and SHA. Pre-existing errors in untouched files are reported as INFO.
# ai/worker `tsc` (NodeNext) cannot resolve the @shotbro/contracts barrel at all — a known,
# pre-existing setup issue (runtime uses tsx/bundlers and is unaffected) — so they are INFO only.
set -uo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SHA="${2:-HEAD}"
BASE="${3:-${SHA}~1}"
SHORT="$(git -C "$ROOT" rev-parse --short=8 "$SHA")"
WORK="/tmp/shotbro-unit-${SHORT}"
NODE_IMAGE="${UNIT_NODE_IMAGE:-node:22-alpine}"
VOLUME="${UNIT_NODE_MODULES_VOLUME:-shotbro-unit-node-modules}"

rm -rf "$WORK"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT
git -C "$ROOT" archive "$SHA" | tar -x -C "$WORK"
git -C "$ROOT" diff --name-only "$BASE" "$SHA" >"$WORK/.changed-files"
echo "unit_tests_start sha=${SHORT} base=$(git -C "$ROOT" rev-parse --short=8 "$BASE") changed=$(wc -l <"$WORK/.changed-files") $(date -Is)"

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
test_step() {
  name="$1"; shift
  if "$@" >/tmp/step.raw 2>&1; then ok=1; else ok=0; fi
  sed "s/\x1b\[[0-9;]*m//g" /tmp/step.raw >/tmp/step.log
  grep -E "canvas" /tmp/step.log | grep -E "✓|×|FAIL" | sed "s/^/  /"
  if [ "$ok" = 1 ]; then
    echo "STEP_OK $name $(grep -E "Tests +[0-9]" /tmp/step.log | tail -1)"
  else
    echo "STEP_FAIL $name"; grep -v "^\[WARN\]" /tmp/step.log | tail -60; fails=$((fails+1))
  fi
}
# $1 name, $2 package dir prefix (paths in tsc output are relative to it), rest = command
tsc_gate() {
  name="$1"; dir="$2"; shift 2
  "$@" >/tmp/tsc.log 2>&1
  total=$(grep -c "error TS" /tmp/tsc.log || true)
  mine=$(grep "error TS" /tmp/tsc.log | while IFS= read -r line; do
    f="${line%%(*}"; f="${f#./}"
    p=$(node -e "console.log(require(\"path\").posix.normalize(process.argv[1]))" "$dir/$f")
    grep -qx "$p" /app/.changed-files && echo "$line"
  done)
  if [ -n "$mine" ]; then echo "STEP_FAIL $name"; echo "$mine" | head -60; fails=$((fails+1));
  else echo "STEP_OK $name (pre-existing errors in untouched files: $total)"; fi
}
info_tsc() {
  name="$1"; shift
  "$@" >/tmp/tsc.log 2>&1
  echo "INFO $name tsc errors: $(grep -c "error TS" /tmp/tsc.log || true) (NodeNext barrel issue, not gating)"
}
tsc_gate contracts-typecheck packages/contracts pnpm --filter @shotbro/contracts exec tsc --noEmit
tsc_gate api-typecheck apps/api pnpm --filter api exec tsc -p tsconfig.json --noEmit
tsc_gate web-typecheck apps/web pnpm --filter web exec tsc --noEmit
info_tsc ai-typecheck pnpm --filter @shotbro/ai exec tsc --noEmit
info_tsc worker-typecheck pnpm --filter worker exec tsc --noEmit
test_step ai-test env S3_ENDPOINT=http://127.0.0.1:9000 S3_REGION=us-east-1 S3_BUCKET=unit-test S3_ACCESS_KEY_ID=unit-test-key S3_SECRET_ACCESS_KEY=unit-test-secret pnpm --filter @shotbro/ai test
test_step web-test pnpm --filter web exec vitest run src
exit $fails
'
CODE=$?
echo "UNIT_EXIT_CODE=${CODE} sha=${SHORT} $(date -Is)"
exit "$CODE"
