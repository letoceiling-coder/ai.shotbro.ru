#!/usr/bin/env bash
# Script → Storyboard → Timeline scene ids must survive mock agent production run.
set -euo pipefail
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
if (!password) process.exit(1);

async function json(path, init = {}, cookies = "") {
  const res = await fetch(base + path, {
    ...init,
    headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru", Cookie: cookies, ...(init.headers ?? {}) },
  });
  const set = res.headers.getSetCookie?.() ?? [];
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { status: res.status, body, cookies: mergeCookies(cookies, set) };
}
function mergeCookies(prev, setCookie) {
  const jar = Object.fromEntries(prev.split(";").map((s) => s.trim()).filter(Boolean).map((p) => p.split("=")).filter(([k]) => k));
  for (const line of setCookie) {
    const [pair] = line.split(";");
    const [k, v] = pair.split("=");
    if (k) jar[k.trim()] = v ?? "";
  }
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

function scriptIds(payload) {
  return (payload?.scenes ?? []).map((s) => s.id).filter(Boolean);
}
function timelineIds(payload) {
  const video = payload?.tracks?.find((t) => t.type === "VIDEO");
  return [...(video?.clips ?? [])].sort((a, b) => a.order - b.order).map((c) => c.sceneId).filter(Boolean);
}

(async () => {
  let cookies = "";
  await json("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) }).then((s) => {
    cookies = s.cookies;
  });
  const proj = await json("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "SceneId " + Date.now(), mock: true }) }, cookies);
  const projectId = proj.body.id;
  for (const title of ["Scene A", "Scene B", "Scene C"]) {
    await json(`/api/v1/projects/${projectId}/scripts/scenes`, { method: "POST", body: JSON.stringify({ title }) }, cookies);
  }
  const scriptBefore = await json(`/api/v1/projects/${projectId}/script`, {}, cookies);
  const beforeScriptIds = scriptIds(scriptBefore.body?.payload);
  await json(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }, cookies);
  await json(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, cookies);
  const tlBefore = await json(`/api/v1/projects/${projectId}/timeline`, {}, cookies);
  const beforeTimelineIds = timelineIds(tlBefore.body?.payload);

  const conv = await json(`/api/v1/projects/${projectId}/conversations`, { method: "POST", body: JSON.stringify({ title: "SceneId" }) }, cookies);
  await json(`/api/v1/projects/${projectId}/agent/runtime-rollout`, { method: "POST", body: JSON.stringify({ enable: true, reason: "scene-id-int" }) }, cookies);
  await json(`/api/v1/projects/${projectId}/agent/runs`, {
    method: "POST",
    body: JSON.stringify({ userRequest: "mock production", conversationId: conv.body.id }),
  }, cookies);

  for (let i = 0; i < 36; i++) {
    const appr = await json(`/api/v1/projects/${projectId}/approvals`, {}, cookies);
    const pending = (appr.body.items ?? []).filter((a) => a.status === "PENDING");
    if (!pending.length) break;
    for (const p of pending) {
      await json(`/api/v1/approvals/${p.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: p.targetVersion, payloadHash: p.payloadHash, idempotencyKey: crypto.randomUUID() }),
      }, cookies);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  const scriptAfter = await json(`/api/v1/projects/${projectId}/script`, {}, cookies);
  const tlAfter = await json(`/api/v1/projects/${projectId}/timeline`, {}, cookies);
  const afterScriptIds = scriptIds(scriptAfter.body?.payload);
  const afterTimelineIds = timelineIds(tlAfter.body?.payload);

  const scriptStable = beforeScriptIds.length && beforeScriptIds.every((id) => afterScriptIds.includes(id));
  const timelineStable =
    beforeTimelineIds.length &&
    beforeTimelineIds.length === afterTimelineIds.length &&
    beforeTimelineIds.every((id, i) => id === afterTimelineIds[i]);
  const noMockTemplate = !afterScriptIds.every((id) => /^scene-[123]$/.test(id));

  const ok = scriptStable && timelineStable && noMockTemplate;
  console.log(
    JSON.stringify(
      {
        ok,
        projectId,
        beforeScriptIds,
        afterScriptIds,
        beforeTimelineIds,
        afterTimelineIds,
        scriptStable,
        timelineStable,
        noMockTemplate,
      },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 2);
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
NODE
