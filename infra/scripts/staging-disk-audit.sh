#!/usr/bin/env bash
# Read-only disk / Docker audit for ai.shotbro.ru staging VPS.
# Usage: staging-disk-audit.sh [report_file]
set -euo pipefail

REPORT="${1:-/var/log/shotbro-disk-audit-$(date +%Y%m%d%H%M%S).txt}"
SRC="${SHOTBRO_SRC:-/var/www/ai.shotbro.ru-src}"
WEB_ROOT="${SHOTBRO_WEB_ROOT:-/var/www/ai.shotbro.ru}"

exec > >(tee "$REPORT") 2>&1

section() { echo ""; echo "======== $* ========"; }

section "TIMESTAMP"
date -Is
hostname

section "FILESYSTEM"
df -hT /
df -ih / | head -2

section "TOP LEVEL (same filesystem)"
du -xhd1 / 2>/dev/null | sort -hr | head -15

section "/var"
du -xhd1 /var 2>/dev/null | sort -hr | head -12

section "/var/lib"
du -xhd1 /var/lib 2>/dev/null | sort -hr | head -15

section "CONTAINERD"
du -xhd1 /var/lib/containerd 2>/dev/null | sort -hr | head -10

section "DOCKER SYSTEM DF"
docker system df -v 2>/dev/null | head -80 || echo "docker unavailable"

section "SHOTBRO WEB IMAGES"
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}' 2>/dev/null \
  | grep -E 'shotbro-web|infra-web|REPOSITORY' || true

section "ACTIVE SHOTBRO CONTAINERS"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null \
  | grep -E 'infra-web|ai-shotbro-staging|NAMES' || true

section "BUILD CACHE SUMMARY"
docker system df 2>/dev/null | grep -E 'TYPE|Build' || true

section "CONTAINER LOGS (top 10 by size)"
find /var/lib/docker/containers -name '*-json.log' -printf '%s %p\n' 2>/dev/null \
  | sort -rn | head -10 | awk '{printf "%.1f MiB %s\n", $1/1048576, $2}'

section "JOURNALD"
journalctl --disk-usage 2>/dev/null || true

section "SHOTBRO SOURCE TREE"
du -sh "$SRC" "$SRC/node_modules" "$SRC/apps/web/test-results" "$SRC/apps/web/playwright-report" 2>/dev/null || true

section "WEB STANDALONE BACKUPS"
du -sh "$WEB_ROOT"/standalone "$WEB_ROOT"/standalone.bak-* 2>/dev/null | sort -hr | head -20 || true
ls -1 "$WEB_ROOT"/standalone.bak-* 2>/dev/null | wc -l | awk '{print "standalone.bak count:", $1}'

section "E2E LOGS"
du -sh /var/log/shotbro-e2e 2>/dev/null || true
ls -la /var/log/shotbro-e2e 2>/dev/null | tail -15 || true

section "POSTGRES STAGING (size only)"
docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -tAc \
  "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null || echo "postgres exec skipped"

section "MINIO STAGING (data dir size)"
docker exec ai-shotbro-staging-minio-1 du -sh /data 2>/dev/null || echo "minio exec skipped"

section "DELETED OPEN FILES (count)"
lsof +L1 2>/dev/null | wc -l | awk '{print "lsof +L1 lines:", $1}'

section "DISK THRESHOLDS"
used_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
free_gb=$(df -Pk / | awk 'NR==2 {printf "%.1f", $4/1024/1024}')
echo "used_percent=${used_pct} free_gb=${free_gb}"
if [ "$used_pct" -ge 90 ]; then echo "STATUS=CRITICAL_BLOCK_BUILDS"; elif [ "$used_pct" -ge 85 ]; then echo "STATUS=CRITICAL"; elif [ "$used_pct" -ge 75 ]; then echo "STATUS=WARNING"; else echo "STATUS=OK"; fi

echo ""
echo "Report written to: $REPORT"
