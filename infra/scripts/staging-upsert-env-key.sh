#!/usr/bin/env bash
# Upsert one key=value in staging.env without printing the value. VPS only.
set -euo pipefail
ENVF="${1:?staging.env path}"
KEY="${2:?key name}"
VAL="${3:?value}"
tmp="${ENVF}.tmp.$$"
grep -v "^${KEY}=" "$ENVF" > "$tmp" || true
printf '%s=%s\n' "$KEY" "$VAL" >> "$tmp"
mv "$tmp" "$ENVF"
chmod 600 "$ENVF"
