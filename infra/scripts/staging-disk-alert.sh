#!/usr/bin/env bash
# Lightweight disk alert — cron-friendly, no secrets.
# Install: infra/scripts/staging-install-disk-cron.sh (VPS)
set -euo pipefail

WARN_PCT="${DISK_WARN_PCT:-75}"
CRIT_PCT="${DISK_CRIT_PCT:-85}"
BLOCK_PCT="${DISK_BLOCK_PCT:-90}"
LOG="${DISK_ALERT_LOG:-/var/log/shotbro-disk-alert.log}"

used_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
free_gb=$(df -Pk / | awk 'NR==2 {printf "%.2f", $4/1024/1024}')
images_gb=$(docker system df 2>/dev/null | awk '/Images/{print $4}' | tr -d 'GB' || echo "?")
cache_gb=$(docker system df 2>/dev/null | awk '/Build Cache/{print $4}' | tr -d 'GB' || echo "?")

msg="$(date -Is) used=${used_pct}% free_gb=${free_gb} docker_images_gb=${images_gb} build_cache_gb=${cache_gb}"

if [ "$used_pct" -ge "$BLOCK_PCT" ]; then
  level=BLOCK
elif [ "$used_pct" -ge "$CRIT_PCT" ]; then
  level=CRITICAL
elif [ "$used_pct" -ge "$WARN_PCT" ]; then
  level=WARNING
else
  level=OK
fi

echo "${level} ${msg}" | tee -a "$LOG"

if [ "$level" != OK ]; then
  logger -t shotbro-disk "${level} ${msg}"
fi

exit 0
