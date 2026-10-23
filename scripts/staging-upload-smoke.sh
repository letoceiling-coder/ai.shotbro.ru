#!/usr/bin/env bash
# Presigned upload smoke (host → API 3021, PUT via public or loopback MinIO).
set -euo pipefail
API="${API:-http://127.0.0.1:3021}"
# Optional rewrite when testing against a different public origin (must match signer host).
MINIO_PUT_BASE="${MINIO_PUT_BASE:-}"
CJ="$(mktemp)"
PNG="$(mktemp --suffix=.png)"
trap 'rm -f "$CJ" "$PNG"' EXIT
python3 -c "import base64, pathlib; pathlib.Path('$PNG').write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='))"

EMAIL="${SMOKE_EMAIL:-upload-smoke-$(date +%s)@test.local}"

curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/auth/sign-up/email" \
  -H "Content-Type: application/json" -H "Origin: https://ai.shotbro.ru" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"Upload Smoke\"}" >/dev/null

PROJ=$(curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/v1/projects" \
  -H "Content-Type: application/json" \
  -d '{"title":"Upload smoke"}')
PID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<<"$PROJ")

INIT=$(curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/v1/uploads/init" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PID\",\"filename\":\"1x1.png\",\"mimeType\":\"image/png\",\"sizeBytes\":$(wc -c <"$PNG")}")
SESSION=$(python3 -c "import json,sys; print(json.load(sys.stdin)['sessionId'])" <<<"$INIT")
URL=$(python3 -c "import json,sys; print(json.load(sys.stdin)['uploadUrl'])" <<<"$INIT")

# Optional: rewrite host for loopback MinIO tests (signature must match signer config)
if [[ -n "${MINIO_PUT_BASE:-}" ]]; then
  URL=$(python3 -c "import os,sys,urllib.parse; u=urllib.parse.urlparse(sys.argv[1]); b=os.environ['MINIO_PUT_BASE'].rstrip('/'); print(b+u.path+('?'+u.query if u.query else ''))" "$URL")
fi

HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT "$URL" -H "Content-Type: image/png" --data-binary @"$PNG")
echo "PUT status: $HTTP"
[[ "$HTTP" == "200" || "$HTTP" == "204" ]]

curl -sS -c "$CJ" -b "$CJ" -X POST "$API/api/v1/uploads/$SESSION/complete" -H "Content-Type: application/json" -d '{}' | head -c 200
echo
echo "UPLOAD_SMOKE_OK"
