#!/usr/bin/env bash
# Read-only report: co-tenant Docker usage (Dify, parser, etc.) — Shotbro does NOT delete these.
# Usage: staging-cotenant-docker-report.sh [output_file]
set -euo pipefail

OUT="${1:-/var/log/shotbro-cotenant-docker-$(date +%Y%m%d).txt}"
exec > >(tee "$OUT") 2>&1

echo "=== Co-tenant Docker report $(date -Is) ==="
df -h / | tail -1
docker system df

echo ""
echo "=== Running containers (non-Shotbro) ==="
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' | grep -Ev 'infra-web|ai-shotbro-staging|NAMES' || true

echo ""
echo "=== Images by repository (size, in-use count) ==="
docker images --format '{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}' | sort | while IFS=$'\t' read -r repo tag size id; do
  case "$repo" in
    shotbro/*|shotbro-web-build|infra-web|ai-shotbro-staging-api|ai-shotbro-staging-worker) continue ;;
  esac
  cnt=$(docker ps -a --filter "ancestor=${id}" --format '{{.ID}}' | wc -l)
  dangling=""
  [ "$tag" = "<none>" ] && dangling="DANGLING"
  echo "${repo}:${tag} size=${size} containers=${cnt} ${dangling}"
done

echo ""
echo "=== Dangling images (all projects) ==="
docker images -f dangling=true --format '{{.ID}}\t{{.Size}}\t{{.CreatedSince}}' | head -30

echo ""
echo "=== Stopped containers ==="
docker ps -a --filter status=exited --format '{{.Names}}\t{{.Image}}' | head -20

echo ""
echo "Report: $OUT"
echo "NOTE: Shotbro cleanup scripts never remove rows above without owner approval."
