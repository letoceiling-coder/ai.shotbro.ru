#!/usr/bin/env bash
set -euo pipefail
# Full Phase 3 mock production smoke (API-only, uses container env). No paid AI.
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const base = "http://127.0.0.1:3001";
const email = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const password = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
if (!password) {
  console.error("missing INTEGRATION_USER_A_PASSWORD");
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

async function waitHealth() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${base}/api/v1/health/live`);
      if (r.ok) return;
    } catch {
      /* retry */
    }
    await sleep(2000);
  }
  throw new Error("api_not_ready");
}

async function signIn() {
  const r = await json("/api/auth/sign-in/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (r.status !== 200) throw new Error("sign_in_failed " + r.status);
  return r.cookies;
}

async function approveAll(cookies, projectId, rounds = 12) {
  for (let round = 0; round < rounds; round++) {
    const list = await json(`/api/v1/projects/${projectId}/approvals`, {}, cookies);
    if (list.status !== 200) throw new Error("approvals_list " + list.status);
    const pending = (list.body.items ?? []).filter((a) => a.status === "PENDING");
    if (!pending.length) return;
    for (const row of pending) {
      await json(
        `/api/v1/approvals/${row.id}/approve`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: row.targetVersion,
            payloadHash: row.payloadHash,
            idempotencyKey: `smoke-approve-${row.id}-${round}`,
          }),
        },
        cookies,
      );
    }
    await sleep(2500);
  }
}

(async () => {
  await waitHealth();
  let cookies = await signIn();
  const ts = Date.now();
  const created = await json(
    "/api/v1/projects",
    { method: "POST", body: JSON.stringify({ title: `Phase3 smoke ${ts}` }) },
    cookies,
  );
  if (created.status !== 201 && created.status !== 200) throw new Error("create_project " + created.status);
  const projectId = created.body.id;
  const convs = await json(`/api/v1/projects/${projectId}/conversations`, {}, cookies);
  const conversationId = convs.body[0]?.id;
  const run = await json(
    `/api/v1/projects/${projectId}/agent/runs`,
    {
      method: "POST",
      body: JSON.stringify({
        userRequest: "Рекламный ролик 15 сек 9:16, три сцены с озвучкой для бренда TestCo",
        conversationId,
      }),
    },
    cookies,
  );
  if (run.status !== 201 && run.status !== 200) throw new Error("create_run " + run.status);
  const runId = run.body.id;
  await approveAll(cookies, projectId, 10);
  let finalState = "UNKNOWN";
  for (let i = 0; i < 90; i++) {
    const st = await json(`/api/v1/projects/${projectId}/agent/runs/${runId}`, {}, cookies);
    finalState = st.body.productionState;
    if (st.body.status === "COMPLETED" && finalState === "COMPLETED") break;
    if (String(finalState).includes("WAITING") || finalState === "NEEDS_REVISION") {
      await approveAll(cookies, projectId, 3);
    }
    await sleep(4000);
  }
  if (finalState !== "COMPLETED") throw new Error("production_not_completed " + finalState);
  let deliveryId;
  for (let i = 0; i < 30; i++) {
    const assets = await json(`/api/v1/projects/${projectId}/assets`, {}, cookies);
    const delivery = (assets.body ?? []).find(
      (a) => a.mimeType === "video/mp4" && String(a.originalName ?? "").includes("mock-delivery"),
    );
    if (delivery) {
      deliveryId = delivery.id;
      break;
    }
    await sleep(2000);
  }
  if (!deliveryId) throw new Error("no_mock_delivery_mp4");
  const dl = await json(`/api/v1/assets/${deliveryId}/download-url`, {}, cookies);
  if (dl.status !== 200) throw new Error("download_url " + dl.status);
  console.log(
    JSON.stringify({
      ok: true,
      scenario: "phase3_fallback",
      projectId,
      runId,
      deliveryAssetId: deliveryId,
      mock: true,
    }),
  );
})().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
NODE
