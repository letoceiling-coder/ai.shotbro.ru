#!/usr/bin/env bash
set -euo pipefail
ENVF="${1:-/var/www/ai.shotbro.ru-src/infra/staging.env}"
if grep -q '^INTEGRATION_PROVISION_ENABLED=' "$ENVF"; then
  sed -i 's/^INTEGRATION_PROVISION_ENABLED=.*/INTEGRATION_PROVISION_ENABLED=false/' "$ENVF"
else
  echo 'INTEGRATION_PROVISION_ENABLED=false' >> "$ENVF"
fi
cd "$(dirname "$ENVF")"
docker compose --env-file staging.env -f docker-compose.staging.yml up -d api
echo "provisioning disabled on staging API"
