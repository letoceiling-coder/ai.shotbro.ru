#!/usr/bin/env bash
# One-time: map running/staging images to shotbro/*:current|:rollback tags (no rebuild).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=staging-shotbro-common.sh
source "${SCRIPT_DIR}/staging-shotbro-common.sh"

log() { shotbro_log "bootstrap $*"; }

if docker ps --format '{{.Names}}' | grep -q '^infra-web-1$'; then
  ref=$(docker inspect infra-web-1 --format '{{.Config.Image}}')
  docker tag "$ref" shotbro/web:current
  log "web:current<=${ref}"
fi

if docker image inspect infra-web:rollback >/dev/null 2>&1; then
  docker tag infra-web:rollback shotbro/web:rollback
elif docker image inspect shotbro-web-build:3240e70 >/dev/null 2>&1; then
  docker tag shotbro-web-build:3240e70 shotbro/web:rollback
fi

if docker ps --format '{{.Names}}' | grep -q '^ai-shotbro-staging-api-1$'; then
  ref=$(docker inspect ai-shotbro-staging-api-1 --format '{{.Config.Image}}')
  docker tag "$ref" shotbro/api:current
  log "api:current<=${ref}"
fi

if docker ps --format '{{.Names}}' | grep -q '^ai-shotbro-staging-worker-1$'; then
  ref=$(docker inspect ai-shotbro-staging-worker-1 --format '{{.Config.Image}}')
  docker tag "$ref" shotbro/worker:current
  log "worker:current<=${ref}"
fi

shotbro_gc_images
shotbro_protected_image_ids | while read -r id; do log "protected ${id}"; done
log "bootstrap_done"
