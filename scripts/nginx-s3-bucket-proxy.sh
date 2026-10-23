#!/usr/bin/env bash
# Path-style presigned S3: /{bucket}/... → loopback MinIO (must match resolveS3SigningEndpoint).
set -euo pipefail
BUCKET="${S3_BUCKET:-shotbro-staging}"
CONF="/etc/nginx/sites-enabled/ai.shotbro.ru.conf"
MARK="location /${BUCKET}/"
if grep -qF "$MARK" "$CONF"; then
  echo "S3 bucket proxy already configured for /${BUCKET}/"
  exit 0
fi
TMP=$(mktemp)
awk -v bucket="$BUCKET" '
  /location \/api\/ \{/ && !done {
    print "    location /" bucket "/ {"
    print "        proxy_pass http://127.0.0.1:9003;"
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
cp "$CONF" "${CONF}.bak-s3bucket-$(date +%Y%m%d)"
mv "$TMP" "$CONF"
nginx -t
systemctl reload nginx
echo "nginx /${BUCKET}/ → MinIO :9003 OK"
