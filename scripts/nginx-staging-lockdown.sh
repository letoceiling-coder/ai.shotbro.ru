#!/usr/bin/env bash
# HTTP basic auth for /api/ on ai.shotbro.ru (staging API). Run on VPS once.
set -euo pipefail
CONF="/etc/nginx/sites-enabled/ai.shotbro.ru.conf"
HTPASS="/etc/nginx/.htpasswd-ai-shotbro-staging"
if [[ ! -f "$HTPASS" ]]; then
  echo "Create $HTPASS (e.g. htpasswd -c $HTPASS dev_staging)"
  exit 1
fi
if grep -q 'auth_basic "Shotbro Staging API"' "$CONF"; then
  echo "basic auth already configured"
  exit 0
fi
TMP=$(mktemp)
awk '
  /location \/api\/ \{/ {
    print
    print "        auth_basic \"Shotbro Staging API\";"
    print "        auth_basic_user_file /etc/nginx/.htpasswd-ai-shotbro-staging;"
    next
  }
  { print }
' "$CONF" >"$TMP"
cp "$CONF" "${CONF}.bak-lockdown-$(date +%Y%m%d)"
mv "$TMP" "$CONF"
nginx -t
systemctl reload nginx
echo "nginx /api/ now requires basic auth"
