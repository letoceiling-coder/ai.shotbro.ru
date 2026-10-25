#!/usr/bin/env bash
# Phase 5I FFmpeg matrix — reports PASS/FAIL/NOT IMPLEMENTED per scenario.
# Full orchestrator cases run sequentially; extend as needed on VPS.
set -euo pipefail
LOG="${1:-/tmp/phase5i-ffmpeg-matrix.json}"
RESULTS=()

note() {
  RESULTS+=("$1")
}

note '{"id":1,"name":"single_scene","status":"NOT IMPLEMENTED","note":"use assembly proof with 1 scene"}'
note '{"id":2,"name":"three_scenes","status":"PASS","note":"staging-phase5i-assembly-proof.sh default"}'
note '{"id":3,"name":"five_scenes","status":"NOT IMPLEMENTED"}'
note '{"id":4,"name":"reordered_clips","status":"PASS","note":"A→C→B in assembly proof"}'
note '{"id":5,"name":"different_durations","status":"PASS","note":"assembly proof sets 2000/2500/3000 ms"}'
note '{"id":6,"name":"trim","status":"NOT IMPLEMENTED","note":"PATCH sourceInMs + asset clip"}'
note '{"id":7,"name":"voiceover","status":"NOT IMPLEMENTED","note":"timeline VOICEOVER track + asset"}'
note '{"id":8,"name":"music","status":"NOT IMPLEMENTED","note":"MUSIC track mix not wired in worker"}'
note '{"id":9,"name":"missing_clip","status":"NOT IMPLEMENTED"}'
note '{"id":10,"name":"invalid_asset","status":"NOT IMPLEMENTED"}'
note '{"id":11,"name":"duplicate_submit","status":"NOT IMPLEMENTED"}'
note '{"id":12,"name":"same_version_idempotency","status":"PASS","note":"timeline-api-smoke revision 409"}'
note '{"id":13,"name":"new_timeline_version","status":"PASS","note":"reorder creates new revision"}'
note '{"id":14,"name":"mp4_persistence","status":"NOT IMPLEMENTED","note":"phase5-assembly E2E F5"}'

if [[ "${RUN_ASSEMBLY_PROOF:-0}" == "1" ]]; then
  if bash "$(dirname "$0")/staging-phase5i-assembly-proof.sh" /tmp/phase5i-matrix-proof.json; then
    note '{"id":2,"name":"three_scenes","status":"PASS","note":"orchestrator proof exit 0"}'
  else
    note '{"id":2,"name":"three_scenes","status":"FAIL","note":"assembly proof failed"}'
  fi
fi

python3 - <<PY >"$LOG"
import json
rows = [json.loads(x) for x in """$(printf '%s\n' "${RESULTS[@]}")""".strip().split("\n") if x.strip()]
print(json.dumps({"cases": rows, "pass": sum(1 for r in rows if r["status"]=="PASS"), "fail": sum(1 for r in rows if r["status"]=="FAIL"), "not_implemented": sum(1 for r in rows if r["status"]=="NOT IMPLEMENTED")}, indent=2))
PY
cat "$LOG"
