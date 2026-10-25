#!/usr/bin/env bash
# Install hourly disk alert + weekly audit on VPS (run as root once).
set -euo pipefail
SRC="${1:-/var/www/ai.shotbro.ru-src}"
AUDIT="${SRC}/infra/scripts/staging-disk-audit.sh"
ALERT="${SRC}/infra/scripts/staging-disk-alert.sh"
chmod +x "$AUDIT" "$ALERT" "${SRC}/infra/scripts/staging-safe-cleanup.sh"

cat >/etc/cron.d/shotbro-disk <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
# Shotbro staging disk monitoring (no destructive actions)
0 * * * * root ${ALERT} >/dev/null 2>&1
15 3 * * 0 root ${AUDIT} /var/log/shotbro-disk-audit-weekly.txt >/dev/null 2>&1
EOF
chmod 644 /etc/cron.d/shotbro-disk
echo "Installed /etc/cron.d/shotbro-disk"
