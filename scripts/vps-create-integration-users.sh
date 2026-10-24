#!/usr/bin/env bash
# Deprecated: use provision-integration-users.sh (Better Auth admin API, no ALLOW_PUBLIC_REGISTER).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export ENV_FILE="${ENV_FILE:-/var/www/ai.shotbro.ru-src/infra/staging.env}"
export API="${API:-http://127.0.0.1:3021}"
exec bash "$DIR/provision-integration-users.sh"
