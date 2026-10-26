#!/usr/bin/env bash
# Phase 5I — prove timeline order A→C→B drives mock FFmpeg assembly (orchestrator path).
set -euo pipefail
OUT="${1:-/tmp/phase5i-assembly-proof.json}"
META="$(mktemp)"
docker exec -i ai-shotbro-staging-api-1 node <<'NODE' >"$META"
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
const { randomUUID } = require("node:crypto");

if (!password) {
  console.error(JSON.stringify({ ok: false, error: "missing password" }));
  process.exit(1);
}

async function json(path, init = {}, cookies = "") {
  const res = await fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ai.shotbro.ru",
      Cookie: cookies,
      ...(init.headers ?? {}),
    },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, cookies: mergeCookies(cookies, set) };
}

function mergeCookies(prev, setCookie) {
  const jar = Object.fromEntries(
    prev
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => p.split("="))
      .filter(([k]) => k),
  );
  for (const line of setCookie) {
    const [pair] = line.split(";");
    const [k, v] = pair.split("=");
    if (k) jar[k.trim()] = v ?? "";
  }
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  let cookies = "";
  const sign = await json("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (sign.status !== 200) throw new Error("sign_in " + sign.status);
  cookies = sign.cookies;

  const proj = await json("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ title: "Phase5I Assembly Proof " + Date.now(), mock: true }),
  }, cookies);
  const projectId = proj.body.id;

  for (const title of ["Proof Scene A", "Proof Scene B", "Proof Scene C"]) {
    await json(`/api/v1/projects/${projectId}/scripts/scenes`, {
      method: "POST",
      body: JSON.stringify({ title }),
    }, cookies);
  }
  const scriptAfterAdd = await json(`/api/v1/projects/${projectId}/scripts`, {}, cookies);
  const bootstrap = (scriptAfterAdd.body?.payload?.scenes ?? []).find(
    (s) => s.title === "Scene 1" && (scriptAfterAdd.body?.payload?.scenes?.length ?? 0) > 3,
  );
  if (bootstrap?.id) {
    await json(`/api/v1/projects/${projectId}/scripts/scenes/${bootstrap.id}/delete`, {
      method: "POST",
      body: "{}",
    }, cookies);
  }
  await json(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }, cookies);
  await json(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, cookies);

  let tl = await json(`/api/v1/projects/${projectId}/timeline`, {}, cookies);
  const video = tl.body.payload.tracks.find((t) => t.type === "VIDEO");
  const clips = [...video.clips].sort((a, b) => a.order - b.order);
  const [sceneA, sceneB, sceneC] = clips;
  if (!sceneA || !sceneB || !sceneC) throw new Error("need_3_clips");

  const dA = 2000;
  const dB = 3000;
  const dC = 2500;
  for (const [clip, dur] of [
    [sceneA, dA],
    [sceneB, dB],
    [sceneC, dC],
  ]) {
    const patch = await json(`/api/v1/projects/${projectId}/timeline/clips/${clip.clipId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...clip, durationMs: dur, expectedRevision: tl.body.payload.revision }),
    }, cookies);
    tl.body = patch.body;
  }

  const reorder = await json(`/api/v1/projects/${projectId}/timeline/reorder`, {
    method: "POST",
    body: JSON.stringify({
      trackId: "track-video",
      clipIds: [sceneA.clipId, sceneC.clipId, sceneB.clipId],
      expectedRevision: tl.body.payload.revision,
    }),
  }, cookies);
  tl.body = reorder.body;

  const prep = await json(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, cookies);
  const prep2 = await json(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, cookies);
  const okHttp = (s) => s >= 200 && s < 300;
  const duplicateSubmitOk =
    okHttp(prep.status) &&
    okHttp(prep2.status) &&
    prep2.body?.snapshot?.timelineVersion === prep.body?.snapshot?.timelineVersion &&
    prep2.body?.snapshot?.timelineHash === prep.body?.snapshot?.timelineHash;

  await json(`/api/v1/projects/${projectId}/agent/runtime-rollout`, {
    method: "POST",
    body: JSON.stringify({ enable: true, reason: "phase5i-assembly-proof" }),
  }, cookies);

  const conv = await json(`/api/v1/projects/${projectId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ title: "Proof" }),
  }, cookies);
  const conversationId = conv.body.id;

  await json(`/api/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: "Собери mock финальный ролик по timeline",
      role: "user",
      idempotencyKey: randomUUID(),
    }),
  }, cookies);

  const runRes = await json(`/api/v1/projects/${projectId}/agent/runs`, {
    method: "POST",
    body: JSON.stringify({
      userRequest: "Собери mock финальный ролик по timeline",
      conversationId,
    }),
  }, cookies);
  if (!runRes.status.toString().startsWith("2")) throw new Error("create_run " + runRes.status);

  let runId = runRes.body.id;
  for (let round = 0; round < 24; round++) {
    const appr = await json(`/api/v1/projects/${projectId}/approvals`, {}, cookies);
    const pending = (appr.body.items ?? []).filter((a) => a.status === "PENDING");
    if (!pending.length) break;
    for (const p of pending) {
      await json(`/api/v1/approvals/${p.id}/approve`, {
        method: "POST",
        body: JSON.stringify({
          expectedVersion: p.targetVersion,
          payloadHash: p.payloadHash,
          idempotencyKey: randomUUID(),
        }),
      }, cookies);
    }
    await sleep(1500);
  }

  let assetId = null;
  for (let i = 0; i < 240; i++) {
    const runs = await json(`/api/v1/projects/${projectId}/agent/runs`, {}, cookies);
    runId = runs.body.items?.[0]?.id ?? runId;
    const assets = await json(`/api/v1/projects/${projectId}/assets`, {}, cookies);
    const list = Array.isArray(assets.body) ? assets.body : assets.body.items ?? [];
    const mp4 = list.find(
      (a) => a.mimeType === "video/mp4" && String(a.originalName ?? "").includes("mock-delivery"),
    );
    if (mp4) {
      assetId = mp4.id;
      break;
    }
    await sleep(3000);
  }
  if (!assetId) throw new Error("timeout_mp4");

  const dl = await json(`/api/v1/assets/${assetId}/download-url`, {}, cookies);

  console.log(
    JSON.stringify({
      projectId,
      runId,
      assetId,
      downloadUrl: dl.body.url,
      durationsMs: { A: dA, C: dC, B: dB },
      timelineOrder: ["A", "C", "B"],
      snapshot: prep.body.snapshot ?? null,
      duplicateSubmitOk,
    }),
  );
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
NODE

WORKER="${WORKER_CONTAINER:-ai-shotbro-staging-worker-1}"
URL="$(python3 -c "import json; print(json.load(open('$META'))['downloadUrl'])")"
PROJECT_ID="$(python3 -c "import json; print(json.load(open('$META'))['projectId'])")"
RUN_ID="$(python3 -c "import json; print(json.load(open('$META'))['runId'])")"
ASSET_ID="$(python3 -c "import json; print(json.load(open('$META'))['assetId'])")"
dA="$(python3 -c "import json; print(json.load(open('$META'))['durationsMs']['A'])")"
dC="$(python3 -c "import json; print(json.load(open('$META'))['durationsMs']['C'])")"
dB="$(python3 -c "import json; print(json.load(open('$META'))['durationsMs']['B'])")"

T1="$(python3 -c "print($dA/2000)")"
T2="$(python3 -c "print($dA/1000 + $dC/2000)")"
T3="$(python3 -c "print($dA/1000 + $dC/1000 + $dB/2000)")"

docker exec "$WORKER" sh -ec "
  set -e
  MP4=/tmp/phase5i-proof.mp4
  wget -q -O \"\$MP4\" '$URL'
  ffprobe -v error -show_entries format=duration:stream=codec_name,width,height -of json \"\$MP4\" > /tmp/phase5i-probe.json
  rgb() {
    ss=\$1
    ffmpeg -hide_banner -loglevel error -ss \"\$ss\" -i \"\$MP4\" -frames 1 -vf scale=1:1 -f rawvideo -pix_fmt rgb24 - | od -An -tu1 | tr -s ' ' | cut -d' ' -f2-4
  }
  rgb '$T1' > /tmp/r1
  rgb '$T2' > /tmp/r2
  rgb '$T3' > /tmp/r3
  rm -f \"\$MP4\"
"

docker cp "$WORKER:/tmp/phase5i-probe.json" /tmp/phase5i-probe.json
R1="$(docker exec "$WORKER" cat /tmp/r1)"
R2="$(docker exec "$WORKER" cat /tmp/r2)"
R3="$(docker exec "$WORKER" cat /tmp/r3)"
python3 - <<PY > /tmp/phase5i-proof-ff.json
import json
print(json.dumps({"probe": json.load(open("/tmp/phase5i-probe.json")), "samples": {"t1": "$T1", "t2": "$T2", "t3": "$T3"}, "rgb": ["$R1".strip(), "$R2".strip(), "$R3".strip()]}))
PY

python3 - <<PY >"$OUT"
import json
meta = json.load(open("$META"))
ff = json.load(open("/tmp/phase5i-proof-ff.json"))

def name(s):
    parts = [int(x) for x in s.split() if x.strip()]
    if len(parts) < 3:
        return "UNKNOWN"
    r, g, b = parts[:3]
    if r > 180 and g < 80 and b < 80: return "RED"
    if g > 180 and r < 80 and b < 80: return "GREEN"
    if b > 180 and r < 80 and g < 80: return "BLUE"
    return f"MIXED({r},{g},{b})"

colors = [name(x) for x in ff["rgb"]]
order_ok = colors == ["RED", "BLUE", "GREEN"]
out = {
    "ok": order_ok,
    "projectId": meta["projectId"],
    "runId": meta["runId"],
    "assetId": meta["assetId"],
    "timelineOrder": meta["timelineOrder"],
    "snapshot": meta.get("snapshot"),
    "duplicateSubmitOk": meta.get("duplicateSubmitOk"),
    "ffprobe": ff.get("probe"),
    "frameColors": colors,
    "expected": ["RED", "BLUE", "GREEN"],
    "sampleTimes": ff.get("samples"),
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if order_ok else 2)
PY

cat "$OUT"
rm -f "$META"
