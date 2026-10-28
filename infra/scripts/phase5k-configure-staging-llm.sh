#!/usr/bin/env bash
# Phase 5K: enable OpenRouter creative LLM on staging (never enables media providers).
set -euo pipefail

ROOT="${1:-/var/www/ai.shotbro.ru-src}"
ENVF="${ROOT}/infra/staging.env"
COMPOSE_DIR="${ROOT}/infra"
SOURCE_KEY="${OPENROUTER_KEY_SOURCE:-/root/.env.shotbro.production}"

if [ ! -f "$ENVF" ]; then
  echo "missing ${ENVF}" >&2
  exit 1
fi

copy_key_from_source() {
  local key="$1"
  if grep -q "^${key}=" "$ENVF" 2>/dev/null; then
    return 0
  fi
  if [ -f "$SOURCE_KEY" ] && grep -q "^${key}=" "$SOURCE_KEY"; then
    grep "^${key}=" "$SOURCE_KEY" >>"$ENVF"
    echo "phase5k: appended ${key} from ${SOURCE_KEY} (value not logged)"
  fi
}

copy_key_from_source OPENROUTER_API_KEY
copy_key_from_source OPENROUTER_HTTPS_PROXY
copy_key_from_source OPENROUTER_APP_URL

if ! grep -q '^OPENROUTER_API_KEY=' "$ENVF" 2>/dev/null; then
  echo "OPENROUTER_API_KEY missing in staging.env and ${SOURCE_KEY}" >&2
  exit 1
fi

append_kv() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENVF"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENVF"
  else
    echo "${key}=${val}" >>"$ENVF"
  fi
}

append_kv OPENROUTER_ENABLED true
append_kv LLM_LIVE_EXECUTION_ENABLED true
append_kv MEDIA_GENERATION_ENABLED false
append_kv IMAGE_GENERATION_ENABLED false
append_kv VIDEO_GENERATION_ENABLED false
append_kv IMAGE_UPSCALE_ENABLED false
append_kv MEDIA_PROVIDER_LIVE_EXECUTION_ENABLED false
append_kv PROVIDER_LIVE_EXECUTION_ENABLED false
append_kv AI_MOCK_MODE true
append_kv OPENROUTER_CONNECT_MODE "auto"
append_kv OPENROUTER_DEFAULT_MODEL "openai/gpt-4o-mini"
append_kv OPENROUTER_MODEL_ALLOWLIST "openai/gpt-4o-mini"
append_kv OPENROUTER_MAX_COST_USD "0.15"
append_kv CREATIVE_AGENT_RUN_MAX_COST_USD "0.12"
append_kv CREATIVE_AGENT_MAX_ITERATIONS "6"
append_kv CREATIVE_AGENT_MAX_TOOL_CALLS "12"
append_kv CREATIVE_AGENT_MAX_OUTPUT_TOKENS "1536"
append_kv CREATIVE_AGENT_MAX_DURATION_MS "90000"
append_kv OPENROUTER_USER_DAILY_MAX_USD "2.0"

key_len=$(grep '^OPENROUTER_API_KEY=' "$ENVF" | cut -d= -f2- | wc -c)
echo "phase5k: OPENROUTER_API_KEY present (chars=${key_len})"

cd "$COMPOSE_DIR"
export COMPOSE_PROJECT_NAME=ai-shotbro-staging
docker compose --env-file staging.env -f docker-compose.staging.yml up -d --no-build api worker
echo "phase5k: api/worker recreated (no image rebuild)"

docker exec ai-shotbro-staging-api-1 wget -qO- http://127.0.0.1:3001/api/v1/health/live >/dev/null
echo "phase5k: api health/live ok"

docker exec ai-shotbro-staging-api-1 printenv LLM_LIVE_EXECUTION_ENABLED OPENROUTER_ENABLED MEDIA_GENERATION_ENABLED | sort
