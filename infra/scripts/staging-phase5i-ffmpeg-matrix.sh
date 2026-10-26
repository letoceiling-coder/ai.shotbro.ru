#!/usr/bin/env bash
# Phase 5I FFmpeg matrix — honest PASS/FAIL/NOT IMPLEMENTED on VPS.
set -euo pipefail
DIR="$(dirname "$0")"
LOG="${1:-/tmp/phase5i-ffmpeg-matrix.json}"
RESULTS=()

note() { RESULTS+=("$1"); }

# 2,4,5 — assembly proof (orchestrator + mock lavfi colors)
if bash "$DIR/staging-phase5i-assembly-proof.sh" /tmp/phase5i-matrix-assembly.json; then
  DUR="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-assembly.json'))['ffprobe']['format']['duration'])")"
  note "{\"id\":2,\"name\":\"three_scenes\",\"status\":\"PASS\",\"duration\":\"$DUR\"}"
  note '{"id":4,"name":"reordered_clips","status":"PASS","note":"A→C→B in assembly proof"}'
  note '{"id":5,"name":"different_durations","status":"PASS","note":"2000/2500/3000 ms in proof"}'
else
  note '{"id":2,"name":"three_scenes","status":"FAIL"}'
  note '{"id":4,"name":"reordered_clips","status":"FAIL"}'
  note '{"id":5,"name":"different_durations","status":"FAIL"}'
fi

# 12,13 — timeline API smoke (revision + reorder)
if bash "$DIR/staging-phase5i-timeline-api-smoke.sh" >/tmp/phase5i-matrix-timeline-smoke.txt 2>&1; then
  note '{"id":12,"name":"same_version_idempotency","status":"PASS","note":"timeline-api-smoke revision conflict"}'
  note '{"id":13,"name":"new_timeline_version","status":"PASS","note":"reorder bumps revision"}'
else
  note '{"id":12,"name":"same_version_idempotency","status":"FAIL"}'
  note '{"id":13,"name":"new_timeline_version","status":"FAIL"}'
fi

# 1 — single-scene assembly via node (mock)
docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-1scene.json 2>/tmp/phase5i-matrix-1scene.err || true
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
(async () => {
  let c = "";
  await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) }).then((s) => { c = s.cookies; });
  const p = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "1scene " + Date.now(), mock: true }) }, c);
  const projectId = p.body.id;
  await j(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }, c);
  await j(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, c);
  const tl = await j(`/api/v1/projects/${projectId}/timeline`, {}, c);
  const clips = tl.body.payload.tracks.find((t) => t.type === "VIDEO").clips;
  console.log(JSON.stringify({ ok: clips.length === 1, clipCount: clips.length }));
})().catch((e) => console.log(JSON.stringify({ ok: false, error: String(e) })));
NODE
if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-1scene.json')).get('ok') else 1)" 2>/dev/null; then
  note '{"id":1,"name":"single_scene","status":"PASS","note":"timeline sync 1 clip"}'
else
  note '{"id":1,"name":"single_scene","status":"FAIL"}'
fi

docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-5scene.json 2>/dev/null || true
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
(async () => {
  let c = "";
  await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) }).then((s) => { c = s.cookies; });
  const p = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "5scene " + Date.now(), mock: true }) }, c);
  const projectId = p.body.id;
  for (let i = 0; i < 5; i++) await j(`/api/v1/projects/${projectId}/scripts/scenes`, { method: "POST", body: JSON.stringify({ title: "S" + i }) }, c);
  await j(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }, c);
  await j(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, c);
  const tl = await j(`/api/v1/projects/${projectId}/timeline`, {}, c);
  const clips = tl.body.payload.tracks.find((t) => t.type === "VIDEO").clips;
  console.log(JSON.stringify({ ok: clips.length >= 5, clipCount: clips.length }));
})().catch((e) => console.log(JSON.stringify({ ok: false })));
NODE
if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-5scene.json')).get('ok') else 1)" 2>/dev/null; then
  note '{"id":3,"name":"five_scenes","status":"PASS","note":"timeline sync 5 clips"}'
else
  note '{"id":3,"name":"five_scenes","status":"FAIL"}'
fi
docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-harness-ctx.json 2>/tmp/phase5i-matrix-harness-ctx.err || true
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
(async () => {
  let c = "";
  await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) }).then((s) => { c = s.cookies; });
  const me = await j("/api/v1/users/me", {}, c);
  const p = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "matrix harness " + Date.now(), mock: true }) }, c);
  console.log(JSON.stringify({ ok: true, projectId: p.body.id, workspaceId: p.body.workspaceId, ownerId: me.body.id }));
})().catch((e) => console.log(JSON.stringify({ ok: false, error: String(e) })));
NODE

if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-harness-ctx.json')).get('ok') else 1)" 2>/dev/null; then
  export PHASE5I_HARNESS_PROJECT_ID="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-harness-ctx.json'))['projectId'])")"
  export PHASE5I_HARNESS_WORKSPACE_ID="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-harness-ctx.json'))['workspaceId'])")"
  export PHASE5I_HARNESS_OWNER_ID="$(python3 -c "import json; print(json.load(open('/tmp/phase5i-matrix-harness-ctx.json'))['ownerId'])")"
  if docker exec \
    -e PHASE5I_HARNESS_PROJECT_ID \
    -e PHASE5I_HARNESS_WORKSPACE_ID \
    -e PHASE5I_HARNESS_OWNER_ID \
    -e TIMELINE_MOCK_USE_ASSETS=true \
    ai-shotbro-staging-worker-1 \
    pnpm exec tsx apps/worker/scripts/phase5i-ffmpeg-harness.ts >/tmp/phase5i-matrix-harness.out 2>/tmp/phase5i-matrix-harness.err; then
    python3 - <<'PY' | while read -r line; do note "$line"; done
import json
for row in json.load(open("/tmp/phase5i-matrix-harness.out"))["harness"]:
    print(json.dumps(row))
PY
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

docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >/tmp/phase5i-matrix-dup.json 2>/dev/null || true
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
(async () => {
  let c = "";
  await j("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) }).then((s) => { c = s.cookies; });
  const p = await j("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "dup " + Date.now(), mock: true }) }, c);
  const projectId = p.body.id;
  await j(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, c);
  const a = await j(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, c);
  const b = await j(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, c);
  const same =
    a.body?.snapshot?.timelineVersion === b.body?.snapshot?.timelineVersion &&
    a.body?.snapshot?.timelineHash === b.body?.snapshot?.timelineHash;
  console.log(JSON.stringify({ ok: same && a.status === 200 && b.status === 200 }));
})().catch((e) => console.log(JSON.stringify({ ok: false })));
NODE
if python3 -c "import json; exit(0 if json.load(open('/tmp/phase5i-matrix-dup.json')).get('ok') else 1)" 2>/dev/null; then
  note '{"id":11,"name":"duplicate_submit","status":"PASS","note":"prepare-assembly idempotent snapshot"}'
else
  note '{"id":11,"name":"duplicate_submit","status":"FAIL"}'
fi

if [ -f /tmp/phase5i-assembly-proof-r10.json ]; then
  P5I_PERSIST_PROJECT="$(python3 -c "import json; p=json.load(open('/tmp/phase5i-assembly-proof-r10.json')); print(p.get('projectId',''))")"
  P5I_PERSIST_ASSET="$(python3 -c "import json; p=json.load(open('/tmp/phase5i-assembly-proof-r10.json')); print(p.get('deliveryAssetId') or p.get('assetId') or '')")"
  if [ -n "$P5I_PERSIST_PROJECT" ] && [ -n "$P5I_PERSIST_ASSET" ]; then
    docker exec -i ai-shotbro-staging-api-1 node <<NODE >/tmp/phase5i-matrix-persist.json 2>/dev/null || true
const base = "http://127.0.0.1:3001";
const projectId = "${P5I_PERSIST_PROJECT}";
const assetId = "${P5I_PERSIST_ASSET}";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
(async () => {
  let c = "";
  const sign = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru" },
    body: JSON.stringify({ email, password }),
  });
  for (const h of sign.headers.getSetCookie?.() ?? []) {
    const [pair] = h.split(";");
    const [k, v] = pair.split("=");
    if (k) c += k.trim() + "=" + (v ?? "") + "; ";
  }
  const read = () =>
    fetch(base + "/api/v1/projects/" + projectId + "/assets", {
      headers: { Cookie: c, Origin: "https://ai.shotbro.ru" },
    }).then((r) => r.json());
  const j1 = await read();
  const j2 = await read();
  const list = (j) => (Array.isArray(j) ? j : j.items ?? []);
  const hit = (j) => list(j).some((a) => a.id === assetId);
  console.log(JSON.stringify({ ok: hit(j1) && hit(j2) }));
})().catch(() => console.log(JSON.stringify({ ok: false })));
NODE
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

python3 - <<PY >"$LOG"
import json
rows = [json.loads(x) for x in """$(printf '%s\n' "${RESULTS[@]}")""".strip().split("\n") if x.strip()]
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
