#!/usr/bin/env bash
# Verify shotbro_resolve_deploy_sha handles HEAD and explicit refs (no docker build).
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

[ -d "$ROOT/.git" ] || shotbro_fail "missing git at ${ROOT}"

h="$(shotbro_resolve_deploy_sha "$ROOT" HEAD)"
short="$(shotbro_git_head_sha "$ROOT")"
[ "$h" = "$short" ] || shotbro_fail "HEAD mismatch: resolved=${h} head=${short}"

full="$(git -C "$ROOT" rev-parse HEAD)"
h2="$(shotbro_resolve_deploy_sha "$ROOT" "$full")"
[ "$h2" = "$short" ] || shotbro_fail "full SHA resolve mismatch"

shotbro_log "deploy_sha_smoke_ok sha=${h}"
