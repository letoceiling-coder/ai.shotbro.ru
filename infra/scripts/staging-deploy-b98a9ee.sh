#!/bin/sh
set -e
SHA=b98a9ee
TAR=/tmp/phase3-deploy-b98a9ee.tar
SRC=/var/www/ai.shotbro.ru-src

cp -a "$SRC/infra/staging.env" /tmp/staging.env.bak
rm -rf "$SRC.bak-pre-${SHA}"
mv "$SRC" "$SRC.bak-pre-${SHA}"
mkdir -p "$SRC"
tar -xf "$TAR" -C "$SRC"
cp -a /tmp/staging.env.bak "$SRC/infra/staging.env"
echo "DEPLOYED=${SHA}" > "$SRC/DEPLOYED.txt"

cd "$SRC/infra"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging

docker compose -f docker-compose.staging.yml --env-file staging.env build api worker
docker compose -f docker-compose.staging.yml --env-file staging.env up -d api worker

docker compose -f docker-compose.yml build web
docker compose -f docker-compose.yml up -d web

docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'ai-shotbro-staging-api|ai-shotbro-staging-worker|infra-web' | head -5

curl -sf http://127.0.0.1:3021/api/v1/health/live
echo OK_API

docker exec ai-shotbro-staging-worker-1 ffmpeg -version | head -1
