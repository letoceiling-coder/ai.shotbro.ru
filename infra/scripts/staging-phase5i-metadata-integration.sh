#!/usr/bin/env bash
# VPS integration: timeline v2 must survive production gate and appear on agent_run + job path.
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

(async () => {
  let cookies = "";
  const sign = await json("/api/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password }) });
  cookies = sign.cookies;
  const proj = await json("/api/v1/projects", { method: "POST", body: JSON.stringify({ title: "Phase5I Meta " + Date.now(), mock: true }) }, cookies);
  const projectId = proj.body.id;
  await json(`/api/v1/projects/${projectId}/scripts/scenes`, { method: "POST", body: JSON.stringify({ title: "A" }) }, cookies);
  await json(`/api/v1/projects/${projectId}/storyboard/sync`, { method: "POST", body: "{}" }, cookies);
  await json(`/api/v1/projects/${projectId}/timeline/sync-from-storyboard`, { method: "POST", body: "{}" }, cookies);
  const prep = await json(`/api/v1/projects/${projectId}/timeline/prepare-assembly`, { method: "POST", body: "{}" }, cookies);
  const snap = prep.body.snapshot;
  if (!snap?.timelineVersion || !snap?.timelineHash) {
    console.log(JSON.stringify({ ok: false, step: "prepare_assembly", snap }, null, 2));
    process.exit(1);
  }
  const conv = await json(`/api/v1/projects/${projectId}/conversations`, { method: "POST", body: JSON.stringify({ title: "Meta" }) }, cookies);
  await json(`/api/v1/conversations/${conv.body.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: "mock production", role: "user", idempotencyKey: crypto.randomUUID() }),
  }, cookies);
  await json(`/api/v1/projects/${projectId}/agent/runtime-rollout`, { method: "POST", body: JSON.stringify({ enable: true, reason: "meta-int" }) }, cookies);
  const runRes = await json(`/api/v1/projects/${projectId}/agent/runs`, {
    method: "POST",
    body: JSON.stringify({ userRequest: "mock", conversationId: conv.body.id }),
  }, cookies);
  const runId = runRes.body.id;
  for (let i = 0; i < 30; i++) {
    const appr = await json(`/api/v1/projects/${projectId}/approvals`, {}, cookies);
    const pending = (appr.body.items ?? []).filter((a) => a.status === "PENDING");
    if (!pending.length) break;
    for (const p of pending) {
      await json(`/api/v1/approvals/${p.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion: p.targetVersion, payloadHash: p.payloadHash, idempotencyKey: crypto.randomUUID() }),
      }, cookies);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  const runs = await json(`/api/v1/projects/${projectId}/agent/runs`, {}, cookies);
  const run = runs.body.items?.find((r) => r.id === runId) ?? runs.body.items?.[0];
  const meta = run?.metadata ?? {};
  const ok =
    Boolean(meta.timelineVersion) &&
    Boolean(meta.timelineHash) &&
    Boolean(meta.timelineDocumentId) &&
    Boolean(meta.productionEnqueued);
  console.log(
    JSON.stringify(
      {
        ok,
        projectId,
        runId,
        metadataKeys: Object.keys(meta),
        timelineVersion: meta.timelineVersion,
        timelineHash: meta.timelineHash ? String(meta.timelineHash).slice(0, 12) + "…" : null,
        productionEnqueued: meta.productionEnqueued,
        prepareSnapshotVersion: snap.timelineVersion,
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
