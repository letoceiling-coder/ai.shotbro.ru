#!/usr/bin/env bash
# Timeline API smoke — isolated test project (run on VPS inside api container context).
set -euo pipefail
ROOT="${1:-/var/www/ai.shotbro.ru-src}"
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
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

const results = [];
function pass(name, detail) {
  results.push({ name, status: "PASS", detail });
}
function fail(name, detail) {
  results.push({ name, status: "FAIL", detail });
}

try {
  let cookies = "";
  const sign = await json("/api/v1/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (sign.status !== 200) throw new Error("sign_in " + sign.status);
  cookies = sign.cookies;

  const proj = await json("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ title: "Phase5I Timeline Smoke " + Date.now(), mock: true }),
  }, cookies);
  if (proj.status !== 201 && proj.status !== 200) throw new Error("create_project " + proj.status);
  const projectId = proj.body.id;
  pass("create_project", projectId);

  await json(`/api/v1/projects/${projectId}/script/scenes`, {
    method: "POST",
    body: JSON.stringify({
      sceneId: "smoke-a",
      title: "A",
      description: "Scene A",
      durationSeconds: 2,
      order: 0,
    }),
  }, cookies);
  await json(`/api/v1/projects/${projectId}/script/scenes`, {
    method: "POST",
    body: JSON.stringify({
      sceneId: "smoke-b",
      title: "B",
      description: "Scene B",
      durationSeconds: 2,
      order: 1,
    }),
  }, cookies);
  await json(`/api/v1/projects/${projectId}/storyboard/sync-from-script`, { method: "POST", body: "{}" }, cookies);
  pass("storyboard_seed", "2 scenes");

  const sync = await json(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, cookies);
  if (!sync.status.toString().startsWith("2")) fail("sync_from_storyboard", sync.status);
  else pass("sync_from_storyboard", sync.body?.version ?? sync.body?.payload?.revision);

  const tl = await json(`/api/v1/projects/${projectId}/timeline`, {}, cookies);
  if (!tl.status.toString().startsWith("2")) fail("get_timeline", tl.status);
  else pass("get_timeline", { version: tl.body.version, revision: tl.body.payload?.revision });

  const video = tl.body.payload?.tracks?.find((t) => t.type === "VIDEO");
  const clips = [...(video?.clips ?? [])].sort((a, b) => a.order - b.order);
  if (clips.length < 2) fail("clip_count", clips.length);
  else pass("clip_count", clips.length);

  const rev = tl.body.payload.revision;
  const reordered = [clips[1].clipId, clips[0].clipId];
  const reorder = await json(`/api/v1/projects/${projectId}/timeline/reorder`, {
    method: "POST",
    body: JSON.stringify({ trackId: "track-video", clipIds: reordered, expectedRevision: rev }),
  }, cookies);
  if (!reorder.status.toString().startsWith("2")) fail("reorder", reorder.status);
  else pass("reorder", reorder.body.payload?.revision);

  const clip0 = reorder.body.payload.tracks.find((t) => t.type === "VIDEO").clips.find((c) => c.clipId === clips[0].clipId);
  const patchDur = await json(`/api/v1/projects/${projectId}/timeline/clips/${clip0.clipId}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...clip0,
      durationMs: 1500,
      expectedRevision: reorder.body.payload.revision,
    }),
  }, cookies);
  if (!patchDur.status.toString().startsWith("2")) fail("patch_duration", patchDur.status);
  else pass("patch_duration", patchDur.body.payload?.revision);

  const conflict = await json(`/api/v1/projects/${projectId}/timeline/reorder`, {
    method: "POST",
    body: JSON.stringify({ trackId: "track-video", clipIds: reordered, expectedRevision: 1 }),
  }, cookies);
  if (conflict.status === 409) pass("revision_409", true);
  else fail("revision_409", conflict.status);

  const val = await json(`/api/v1/projects/${projectId}/timeline/validate`, { method: "POST", body: "{}" }, cookies);
  if (!val.status.toString().startsWith("2")) fail("validate", val.status);
  else pass("validate", val.body.valid);

  const prep = await json(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, cookies);
  if (!prep.status.toString().startsWith("2")) fail("prepare_assembly", prep.status);
  else pass("prepare_assembly", prep.body.snapshot);

  const ok = results.every((r) => r.status === "PASS");
  console.log(JSON.stringify({ ok, projectId, results }, null, 2));
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e), results }, null, 2));
  process.exit(1);
}
NODE
