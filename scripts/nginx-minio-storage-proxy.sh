#!/usr/bin/env bash
# Browser presigned uploads: /minio-storage/ → loopback MinIO (127.0.0.1:9002)
set -euo pipefail
CONF="/etc/nginx/sites-enabled/ai.shotbro.ru.conf"
if grep -q 'location /minio-storage/' "$CONF"; then
  echo "minio-storage proxy already configured"
  exit 0
fi
TMP=$(mktemp)
awk '
  /location \/api\/ \{/ && !done {
    print "    location /minio-storage/ {"
    print "        proxy_pass http://127.0.0.1:9003/;"
    print "        proxy_http_version 1.1;"
    print "        proxy_set_header Host $host;"
    print "        proxy_set_header X-Real-IP $remote_addr;"
    print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
    print "        proxy_set_header X-Forwarded-Proto $scheme;"
    print "        client_max_body_size 512m;"
    print "        if ($request_method = OPTIONS) {"
    print "            add_header Access-Control-Allow-Origin $http_origin;"
    print "            add_header Access-Control-Allow-Methods \"GET, PUT, POST, HEAD, DELETE\";"
    print "            add_header Access-Control-Allow-Headers \"*\";"
    print "            add_header Access-Control-Max-Age 86400;"
    print "            return 204;"
    print "        }"
    print "        add_header Access-Control-Allow-Origin $http_origin always;"
    print "        add_header Access-Control-Expose-Headers \"ETag\" always;"
    print "    }"
    print ""
    done=1
  }
  { print }
' "$CONF" >"$TMP"
cp "$CONF" "${CONF}.bak-minio-$(date +%Y%m%d)"
mv "$TMP" "$CONF"
nginx -t
systemctl reload nginx
echo "nginx /minio-storage/ → MinIO OK"
