#!/bin/sh
set -e
SHA="${1:?commit sha short}"
TAR="/tmp/phase3-deploy-${SHA}.tar"
SRC=/var/www/ai.shotbro.ru-src
cp -a "$SRC/infra/staging.env" /tmp/staging.env.bak
tar -xf "$TAR" -C "$SRC"
cp -a /tmp/staging.env.bak "$SRC/infra/staging.env"
echo "DEPLOYED=${SHA}" > "$SRC/DEPLOYED.txt"
cd "$SRC/infra"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging
docker compose -f docker-compose.staging.yml --env-file staging.env build api worker
docker compose -f docker-compose.staging.yml --env-file staging.env up -d api worker
curl -sf http://127.0.0.1:3021/api/v1/health/live && echo OK
