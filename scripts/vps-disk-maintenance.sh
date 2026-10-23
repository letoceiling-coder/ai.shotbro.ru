#!/usr/bin/env bash
# Safe VPS disk maintenance — does NOT prune volumes or stop running containers.
set -euo pipefail
THRESHOLD_PCT="${DISK_WARN_PCT:-85}"
USE_PCT=$(df / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
echo "Root disk use: ${USE_PCT}%"
df -h /
echo "--- docker system df ---"
docker system df || true
if (( USE_PCT >= THRESHOLD_PCT )); then
  echo "Above ${THRESHOLD_PCT}% — pruning unused build cache and dangling images..."
  docker builder prune -f --filter "until=168h" || true
  docker image prune -f --filter "until=168h" || true
  docker container prune -f --filter "until=168h" || true
fi
echo "--- largest under /var/lib/docker (top 5) ---"
du -sh /var/lib/docker/* 2>/dev/null | sort -hr | head -5 || true
echo "Done. Volumes and running containers untouched."
