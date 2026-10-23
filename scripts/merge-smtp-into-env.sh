#!/usr/bin/env bash
# Merge SMTP keys from a fragment file into a target env (e.g. infra/staging.env).
# Usage: ./scripts/merge-smtp-into-env.sh secrets/smtp-beget.env infra/staging.env
set -euo pipefail
FRAGMENT="${1:?fragment env file}"
TARGET="${2:?target env file}"
python3 - "$FRAGMENT" "$TARGET" <<'PY'
import sys
from pathlib import Path

fragment = Path(sys.argv[1])
target = Path(sys.argv[2])
keys = {
    "SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD", "SMTP_PASS",
    "SMTP_FROM_EMAIL", "SMTP_FROM", "SMTP_FROM_NAME", "EMAIL_ENABLED", "LEAD_NOTIFY_EMAIL",
}
incoming = {}
for line in fragment.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, _, v = line.partition("=")
    k = k.strip()
    if k in keys:
        incoming[k] = v.strip().strip('"').strip("'")

if not incoming:
    raise SystemExit("No SMTP keys found in fragment")

lines = target.read_text(encoding="utf-8").splitlines() if target.exists() else []
out = []
seen = set()
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in keys:
            if k in incoming:
                out.append(f"{k}={incoming[k]}")
                seen.add(k)
            continue
    out.append(line)

for k, v in incoming.items():
    if k not in seen:
        out.append(f"{k}={v}")

target.write_text("\n".join(out).rstrip() + "\n", encoding="utf-8")
PY
chmod 600 "$TARGET"
