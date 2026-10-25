#!/usr/bin/env bash
# Minimal Shotbro staging deploy — current + optional rollback per service.
# Usage:
#   staging-deploy.sh [--dry-run] [--verify] [--service web|api|worker|changed] [SHA]
set -euo pipefail

ROOT="${SHOTBRO_SRC:-/var/www/ai.shotbro.ru-src}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

DRY_RUN=0
VERIFY_ONLY=0
SERVICE="changed"
SHA=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --verify) VERIFY_ONLY=1; shift ;;
    --service) SERVICE="${2:?}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--verify] [--service web|api|worker|changed|all] [SHA]"
      exit 0
      ;;
    *)
      SHA="$1"
      shift
      ;;
  esac
done

[ -d "$ROOT" ] || shotbro_fail "missing ${ROOT}"
SHA="${SHA:-$(shotbro_git_head_sha "$ROOT")}"
shotbro_log "git_head=${SHA} service=${SERVICE} dry_run=${DRY_RUN} verify=${VERIFY_ONLY}"

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    shotbro_log "DRY-RUN: $*"
  else
    "$@"
  fi
}

verify_stack() {
  curl -sf http://127.0.0.1:3020/ >/dev/null || shotbro_fail "web :3020"
  curl -sf http://127.0.0.1:3021/api/v1/health/live >/dev/null || shotbro_fail "api health"
  curl -sf https://ai.shotbro.ru/ >/dev/null || shotbro_fail "https ai.shotbro.ru"
  shotbro_log "verify_ok"
}

if [ "$VERIFY_ONLY" -eq 1 ]; then
  verify_stack
  shotbro_protected_image_ids | while read -r id; do shotbro_log "protected=${id}"; done
  exit 0
fi

resolve_services() {
  case "$SERVICE" in
    web) echo web ;;
    api) echo api ;;
    worker) echo worker ;;
    all) echo "web api worker" ;;
    changed)
      local c
      c=$(shotbro_services_changed_since_deploy "$ROOT")
      if [ -z "$c" ]; then
        shotbro_log "no_changed_files_since_last_deploy"
        echo ""
      else
        echo "$c"
      fi
      ;;
    *) shotbro_fail "unknown --service ${SERVICE}" ;;
  esac
}

SERVICES=$(resolve_services)
if [ -z "$SERVICES" ]; then
  shotbro_log "nothing_to_deploy"
  exit 0
fi

for svc in $SERVICES; do
  case "$svc" in
    web)
      run env SHOTBRO_SRC="$ROOT" "${SCRIPT_DIR}/staging-deploy-web.sh" "$SHA" "$ROOT"
      ;;
    api|worker)
      run env SHOTBRO_SRC="$ROOT" DEPLOY_SHA="$SHA" "${SCRIPT_DIR}/staging-deploy-staging-stack.sh" "$svc" "$SHA" "$ROOT"
      ;;
  esac
done

if [ "$DRY_RUN" -eq 0 ]; then
  echo "$SHA" > "${SHOTBRO_DEPLOY_DIR}/last-deploy-sha"
  verify_stack
  shotbro_gc_images
fi

shotbro_log "deploy_complete services=${SERVICES} sha=${SHA}"
