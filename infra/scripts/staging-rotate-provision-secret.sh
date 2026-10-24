#!/usr/bin/env bash
# Rotate INTEGRATION_PROVISION_SECRET without printing the new value.
set -euo pipefail
ENVF="${1:-/var/www/ai.shotbro.ru-src/infra/staging.env}"
NEW="$(openssl rand -base64 48 | tr -d '\n')"
grep -v '^INTEGRATION_PROVISION_SECRET=' "$ENVF" > "${ENVF}.rot.tmp"
printf 'INTEGRATION_PROVISION_SECRET=%s\n' "$NEW" >> "${ENVF}.rot.tmp"
mv "${ENVF}.rot.tmp" "$ENVF"
chmod 600 "$ENVF"
echo "INTEGRATION_PROVISION_SECRET rotated (value not logged)"
cd "$(dirname "$ENVF")"
docker compose --env-file staging.env -f docker-compose.staging.yml up -d api
sleep 8
echo "api restarted"
