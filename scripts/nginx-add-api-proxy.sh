#!/usr/bin/env bash
# Insert /api/ → 127.0.0.1:3021 into ai.shotbro.ru nginx site (idempotent).
set -euo pipefail
CONF="/etc/nginx/sites-enabled/ai.shotbro.ru.conf"
if grep -q 'location /api/' "$CONF"; then
  echo "nginx /api/ already configured"
  exit 0
fi
TMP=$(mktemp)
awk '
  /location \/ \{/ && !done {
    print "    location /api/ {"
    print "        proxy_pass http://127.0.0.1:3021;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "        proxy_buffering off;"
    print "    }"
    print ""
    done=1
  }
  { print }
' "$CONF" >"$TMP"
cp "$CONF" "${CONF}.bak-phase2-$(date +%Y%m%d)"
mv "$TMP" "$CONF"
nginx -t
systemctl reload nginx
echo "nginx reloaded with /api/ proxy"
