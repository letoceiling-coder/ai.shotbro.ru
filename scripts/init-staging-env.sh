#!/usr/bin/env bash
# Run on VPS inside infra/ — creates staging.env (chmod 600). Does not print secrets.
set -euo pipefail
OUT="${1:-staging.env}"
if [[ -f "$OUT" ]]; then
  echo "Refusing to overwrite existing $OUT" >&2
  exit 1
fi
gen() { openssl rand -hex 24; }
gen32() { openssl rand -base64 32 | tr -d '\n'; }
umask 077
cat >"$OUT" <<EOF
STAGING_POSTGRES_PASSWORD=$(gen)
STAGING_MINIO_USER=shotbro_staging_minio
STAGING_MINIO_PASSWORD=$(gen)
BETTER_AUTH_SECRET=$(gen32)
ALLOW_PUBLIC_REGISTER=false
STAGING_GATE_SECRET=$(gen32)
EOF
chmod 600 "$OUT"
echo "Created $OUT ($(wc -c <"$OUT") bytes)"
