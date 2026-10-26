#!/usr/bin/env bash
# Phase 5I FFmpeg matrix — honest PASS/FAIL/NOT IMPLEMENTED on VPS.
set -euo pipefail
DIR="$(dirname "$0")"
LOG="${1:-/tmp/phase5i-ffmpeg-matrix.json}"
RESULTS=()

note() { RESULTS+=("$1"); }

# Harness project + duplicate submit (auth before other matrix sign-ins)
docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-harness-ctx.json 2>/tmp/phase5i-matrix-harness-ctx.err || true
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
if (!password) {
  console.log(JSON.stringify({ ok: false, error: "missing_password" }));
  process.exit(0);
}
async function j(path, init = {}, cookies = "") {
  const res = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru", Cookie: cookies, ...(init.headers ?? {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, cookies: mergeCookies(cookies, set) };
}
function mergeCookies(prev, setCookie) {
  const jar = Object.fromEntries(prev.split(";").map((s) => s.trim()).filter(Boolean).map((p) => p.split("=")).filter(([k]) => k));
  for (const line of setCookie) { const [pair] = line.split(";"); const [k, v] = pair.split("="); if (k) jar[k.trim()] = v ?? ""; }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
(async () => {
  let c = "";
  const sign = await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
  if (sign.status !== 200) {
    console.log(JSON.stringify({ ok: false, error: "sign_in_" + sign.status }));
    return;
  }
  c = sign.cookies;
  const p = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "matrix harness " + Date.now(), mock: true }) }, c);
  console.log(JSON.stringify({ ok: Boolean(p.body?.id), projectId: p.body?.id ?? null }));
})().catch((e) => console.log(JSON.stringify({ ok: false, error: String(e) })));
NODE

if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-harness-ctx.json')).get('projectId') else 1)" 2>/dev/null; then
  export PHASE5I_HARNESS_PROJECT_ID="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-harness-ctx.json'))['projectId'])")"
  if docker exec -e PHASE5I_HARNESS_PROJECT_ID -e TIMELINE_MOCK_USE_ASSETS=true ai-shotbro-staging-worker-1 pnpm exec tsx apps/worker/scripts/phase5i-ffmpeg-harness.ts >/tmp/phase5i-matrix-harness.out 2>/tmp/phase5i-matrix-harness.err; then
    HARNESS_PARSE_OK=0
    while IFS= read -r line; do note "$line"; done < <(
      python3 - <<'PY'
import json
raw = open("/tmp/phase5i-matrix-harness.out").read()
payload = None
search_from = 0
while True:
    key_at = raw.find('"harness"', search_from)
    if key_at < 0:
        break
    start = raw.rfind("{", 0, key_at)
    if start >= 0:
        try:
            candidate, _end = json.JSONDecoder().raw_decode(raw, start)
            if isinstance(candidate.get("harness"), list):
                payload = candidate
                break
        except json.JSONDecodeError:
            pass
    search_from = key_at + 1
if payload is None:
    raise SystemExit("harness_json_missing")
for row in payload["harness"]:
    print(json.dumps(row))
PY
    ) && HARNESS_PARSE_OK=1
    if [ "$HARNESS_PARSE_OK" -eq 1 ]; then
      :
    else
      note '{"id":6,"name":"trim","status":"FAIL","note":"harness_json_parse"}'
      note '{"id":7,"name":"voiceover","status":"FAIL"}'
      note '{"id":8,"name":"music","status":"FAIL"}'
      note '{"id":9,"name":"missing_clip","status":"FAIL"}'
      note '{"id":10,"name":"invalid_asset","status":"FAIL"}'
    fi
  else
    note '{"id":6,"name":"trim","status":"FAIL","note":"harness exec"}'
    note '{"id":7,"name":"voiceover","status":"FAIL"}'
    note '{"id":8,"name":"music","status":"FAIL"}'
    note '{"id":9,"name":"missing_clip","status":"FAIL"}'
    note '{"id":10,"name":"invalid_asset","status":"FAIL"}'
  fi
else
  note '{"id":6,"name":"trim","status":"FAIL","note":"harness context"}'
  note '{"id":7,"name":"voiceover","status":"FAIL"}'
  note '{"id":8,"name":"music","status":"FAIL"}'
  note '{"id":9,"name":"missing_clip","status":"FAIL"}'
  note '{"id":10,"name":"invalid_asset","status":"FAIL"}'
fi

# 1,3 — clip counts (single sign-in to avoid auth rate limits)
docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-scenes.json 2>/tmp/phase5i-matrix-scenes.err || true
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
async function j(path, init = {}, cookies = "") {
  const res = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru", Cookie: cookies, ...(init.headers ?? {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, cookies: mergeCookies(cookies, set) };
}
function mergeCookies(prev, setCookie) {
  const jar = Object.fromEntries(prev.split(";").map((s) => s.trim()).filter(Boolean).map((p) => p.split("=")).filter(([k]) => k));
  for (const line of setCookie) { const [pair] = line.split(";"); const [k, v] = pair.split("="); if (k) jar[k.trim()] = v ?? ""; }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
function videoClips(tl) {
  return tl.body?.payload?.tracks?.find((t) => t.type === "VIDEO")?.clips ?? [];
}
(async () => {
  const sign = await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
  if (sign.status !== 200) {
    console.log(JSON.stringify({ single: { ok: false }, five: { ok: false }, error: "sign_in_" + sign.status }));
    return;
  }
  const c = sign.cookies;
  const p1 = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "1scene " + Date.now(), mock: true }) }, c);
  const project1 = p1.body.id;
  await j(`/api/v1/projects/${project1}/scripts/scenes`, { method: "POST", body: JSON.stringify({ title: "Bootstrap" }) }, c);
  const script = await j(`/api/v1/projects/${project1}/script`, {}, c);
  for (const sid of (script.body?.payload?.scenes ?? []).map((s) => s.id).slice(1)) {
    await j(`/api/v1/projects/${project1}/scripts/scenes/${sid}/delete`, { method: "POST", body: "{}" }, c);
  }
  await j(`/api/v1/projects/${project1}/storyboard/sync`, { method: "POST", body: "{}" }, c);
  await j(`/api/v1/projects/${project1}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, c);
  const tl1 = await j(`/api/v1/projects/${project1}/timeline`, {}, c);
  const clips1 = videoClips(tl1);
  const p5 = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "5scene " + Date.now(), mock: true }) }, c);
  const project5 = p5.body.id;
  for (let i = 0; i < 4; i++) await j(`/api/v1/projects/${project5}/scripts/scenes`, { method: "POST", body: JSON.stringify({ title: "S" + i }) }, c);
  await j(`/api/v1/projects/${project5}/storyboard/sync`, { method: "POST", body: "{}" }, c);
  await j(`/api/v1/projects/${project5}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, c);
  const tl5 = await j(`/api/v1/projects/${project5}/timeline`, {}, c);
  const clips5 = videoClips(tl5);
  console.log(
    JSON.stringify({
      single: { ok: clips1.length === 1, clipCount: clips1.length },
      five: { ok: clips5.length >= 5, clipCount: clips5.length },
    }),
  );
})().catch((e) => console.log(JSON.stringify({ single: { ok: false }, five: { ok: false }, error: String(e) })));
NODE
if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-scenes.json'))['single'].get('ok') else 1)" 2>/dev/null; then
  note '{"id":1,"name":"single_scene","status":"PASS","note":"timeline sync 1 clip"}'
else
  note '{"id":1,"name":"single_scene","status":"FAIL"}'
fi
if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-scenes.json'))['five'].get('ok') else 1)" 2>/dev/null; then
  note '{"id":3,"name":"five_scenes","status":"PASS","note":"timeline sync 5 clips"}'
else
  note '{"id":3,"name":"five_scenes","status":"FAIL"}'
fi

# 2,4,5 — assembly proof (orchestrator + mock lavfi colors)
if bash "$DIR/staging-phase5i-assembly-proof.sh" /tmp/phase5i-matrix-assembly.json; then
  DUR="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-assembly.json'))['ffprobe']['format']['duration'])")"
  note "{\"id\":2,\"name\":\"three_scenes\",\"status\":\"PASS\",\"duration\":\"$DUR\"}"
  note '{"id":4,"name":"reordered_clips","status":"PASS","note":"A→C→B in assembly proof"}'
  note '{"id":5,"name":"different_durations","status":"PASS","note":"2000/2500/3000 ms in proof"}'
  DUP_PID="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-assembly.json'))['projectId'])")"
  docker exec -i -e PHASE5I_DUP_PID="$DUP_PID" ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-dup.json 2>/dev/null || true
const base = "http://127.0.0.1:3001";
const projectId = process.env.PHASE5I_DUP_PID;
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
async function j(path, init = {}, cookies = "") {
  const res = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru", Cookie: cookies, ...(init.headers ?? {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, cookies: mergeCookies(cookies, set) };
}
function mergeCookies(prev, setCookie) {
  const jar = Object.fromEntries(prev.split(";").map((s) => s.trim()).filter(Boolean).map((p) => p.split("=")).filter(([k]) => k));
  for (const line of setCookie) { const [pair] = line.split(";"); const [k, v] = pair.split("="); if (k) jar[k.trim()] = v ?? ""; }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}
(async () => {
  let c = "";
  const sign = await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
  if (sign.status !== 200) { console.log(JSON.stringify({ ok: false, reason: "sign_in" })); return; }
  c = sign.cookies;
  const a = await j(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, c);
  const b = await j(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, c);
  const same =
    a.body?.snapshot?.timelineVersion === b.body?.snapshot?.timelineVersion &&
    a.body?.snapshot?.timelineHash === b.body?.snapshot?.timelineHash;
  const okHttp = (s) => s >= 200 && s < 300;
  console.log(JSON.stringify({ ok: same && okHttp(a.status) && okHttp(b.status), aStatus: a.status, bStatus: b.status }));
})().catch((e) => console.log(JSON.stringify({ ok: false, reason: String(e) })));
NODE
  if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-dup.json')).get('ok') else 1)" 2>/dev/null; then
    note '{"id":11,"name":"duplicate_submit","status":"PASS","note":"prepare-assembly idempotent on proof project"}'
  else
    note '{"id":11,"name":"duplicate_submit","status":"FAIL"}'
  fi
else
  note '{"id":2,"name":"three_scenes","status":"FAIL"}'
  note '{"id":4,"name":"reordered_clips","status":"FAIL"}'
  note '{"id":5,"name":"different_durations","status":"FAIL"}'
  note '{"id":11,"name":"duplicate_submit","status":"FAIL","note":"assembly proof prerequisite"}'
fi

# 12,13 — timeline API smoke (revision + reorder)
if bash "$DIR/staging-phase5i-timeline-api-smoke.sh" >/tmp/phase5i-matrix-timeline-smoke.txt 2>&1; then
  note '{"id":12,"name":"same_version_idempotency","status":"PASS","note":"timeline-api-smoke revision conflict"}'
  note '{"id":13,"name":"new_timeline_version","status":"PASS","note":"reorder bumps revision"}'
else
  note '{"id":12,"name":"same_version_idempotency","status":"FAIL"}'
  note '{"id":13,"name":"new_timeline_version","status":"FAIL"}'
fi

PERSIST_PROOF="/tmp/phase5i-matrix-assembly.json"
[ -f "$PERSIST_PROOF" ] || PERSIST_PROOF="/tmp/phase5i-assembly-proof-r10.json"
if [ -f "$PERSIST_PROOF" ]; then
  P5I_PERSIST_PROJECT="$(python3 -c "import json; p=json.load(open('$PERSIST_PROOF')); print(p.get('projectId',''))")"
  P5I_PERSIST_ASSET="$(python3 -c "import json; p=json.load(open('$PERSIST_PROOF')); print(p.get('deliveryAssetId') or p.get('assetId') or '')")"
  if [ -n "$P5I_PERSIST_ASSET" ]; then
    # shellcheck source=/dev/null
    set -a && source /var/www/ai.shotbro.ru-src/infra/staging.env && set +a
    H1="$(docker exec -e PGPASSWORD="${STAGING_POSTGRES_PASSWORD}" ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -tAc "select 1 from asset where id='${P5I_PERSIST_ASSET}' and status='READY' limit 1" 2>/dev/null | tr -d '[:space:]')"
    H2="$(docker exec -e PGPASSWORD="${STAGING_POSTGRES_PASSWORD}" ai-shotbro-staging-postgres-1 psql -U shotbro_staging -d shotbro_staging -tAc "select 1 from asset where id='${P5I_PERSIST_ASSET}' and status='READY' limit 1" 2>/dev/null | tr -d '[:space:]')"
    if [ "$H1" = "1" ] && [ "$H2" = "1" ]; then
      echo '{"ok":true}' >/tmp/phase5i-matrix-persist.json
    else
      echo '{"ok":false}' >/tmp/phase5i-matrix-persist.json
    fi
    if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-persist.json')).get('ok') else 1)" 2>/dev/null; then
      note '{"id":14,"name":"mp4_persistence","status":"PASS","note":"r10 delivery asset stable across reads"}'
    else
      note '{"id":14,"name":"mp4_persistence","status":"FAIL"}'
    fi
  else
    note '{"id":14,"name":"mp4_persistence","status":"FAIL","note":"r10 proof missing ids"}'
  fi
else
  note '{"id":14,"name":"mp4_persistence","status":"FAIL","note":"missing r10 proof artifact"}'
fi

RESULTS_FILE="/tmp/phase5i-matrix-results.ndjson"
printf '%s\n' "${RESULTS[@]}" >"$RESULTS_FILE"
export RESULTS_FILE
python3 - <<'PY' >"$LOG"
import json, os
rows = [json.loads(line) for line in open(os.environ["RESULTS_FILE"]) if line.strip()]
print(json.dumps({
  "cases": rows,
  "pass": sum(1 for r in rows if r["status"]=="PASS"),
  "fail": sum(1 for r in rows if r["status"]=="FAIL"),
  "not_implemented": sum(1 for r in rows if r["status"]=="NOT IMPLEMENTED"),
}, indent=2))
PY
cat "$LOG"
FAIL_COUNT="$(python3 -c "import json; d=json.load(open('$LOG')); print(d['fail']+d.get('not_implemented',0))")"
exit "$([[ "$FAIL_COUNT" -eq 0 ]] && echo 0 || echo 2)"
