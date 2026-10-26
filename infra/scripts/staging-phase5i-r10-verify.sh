#!/usr/bin/env bash
# Read-only verification of assembly proof r10 (no new production run).
set -euo pipefail
ART="${1:-/tmp/phase5i-assembly-proof-r10.json}"
if [ ! -f "$ART" ]; then
  echo "{\"ok\":false,\"error\":\"missing $ART\"}"
  exit 1
fi
PROJECT_ID="$(python3 -c "import json; print(json.load(open('$ART'))['projectId'])")"
RUN_ID="$(python3 -c "import json; print(json.load(open('$ART'))['runId'])")"
docker exec ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -t -A -c \
  "SELECT metadata::text FROM agent_run WHERE id='$RUN_ID'" > /tmp/r10-meta.txt 2>/dev/null || true
LEGACY="$(docker logs ai-shotbro-staging-worker-1 2>&1 | grep -c timeline_assembly_fallback_legacy || true)"
WORKER_SHA="$(docker inspect ai-shotbro-staging-worker-1 --format '{{index .Config.Labels \"org.shotbro.build-sha\"}}' 2>/dev/null || echo unknown)"
python3 - <<PY
import json
proof = json.load(open("$ART"))
meta_raw = open("/tmp/r10-meta.txt").read().strip()
meta = json.loads(meta_raw) if meta_raw.startswith("{") else {}
out = {
  "ok": proof.get("ok") is True and proof.get("frameColors") == ["RED", "BLUE", "GREEN"],
  "proof": {"runId": proof.get("runId"), "duration": proof.get("ffprobe", {}).get("format", {}).get("duration"), "frameColors": proof.get("frameColors"), "snapshot": proof.get("snapshot")},
  "db_metadata_has_timeline": bool(meta.get("timelineDocumentId") and meta.get("timelineVersion")),
  "worker_build_sha": "$WORKER_SHA",
  "legacy_fallback_log_hits_on_worker": int("$LEGACY"),
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if out["ok"] else 2)
PY
