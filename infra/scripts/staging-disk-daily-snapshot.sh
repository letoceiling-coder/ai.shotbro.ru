#!/usr/bin/env bash
# Append one JSON line for day-over-day growth (cron, no secrets).
set -euo pipefail
LOG="${DISK_DAILY_LOG:-/var/log/shotbro-disk-daily.jsonl}"
used_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
free_gb=$(df -Pk / | awk 'NR==2 {printf "%.2f", $4/1024/1024}')
containerd_gb=$(du -sx /var/lib/containerd 2>/dev/null | awk '{printf "%.2f", $1/1024/1024}')
docker_lib_gb=$(du -sx /var/lib/docker 2>/dev/null | awk '{printf "%.2f", $1/1024/1024}')
read -r images_gb cache_gb <<<"$(docker system df 2>/dev/null | awk '/Images/{i=$4} /Build Cache/{c=$4} END{print i,c}' | tr -d GB)"
shotbro_imgs=$(docker images --format '{{.Repository}}' 2>/dev/null | grep -c '^shotbro/' || echo 0)
co_imgs=$(docker images --format '{{.Repository}}' 2>/dev/null | grep -vcE '^shotbro/|^REPOSITORY' || echo 0)
line=$(printf '{"ts":"%s","used_pct":%s,"free_gb":%s,"containerd_gb":%s,"docker_lib_gb":%s,"docker_images_gb":"%s","build_cache_gb":"%s","shotbro_image_refs":%s,"other_image_refs":%s}' \
  "$(date -Is)" "$used_pct" "$free_gb" "$containerd_gb" "$docker_lib_gb" "${images_gb:-?}" "${cache_gb:-?}" "$shotbro_imgs" "$co_imgs")
echo "$line" >>"$LOG"
