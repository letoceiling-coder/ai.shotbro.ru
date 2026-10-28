#!/usr/bin/env bash
# Probe OpenRouter via HTTPS_PROXY inside API container (no secrets logged).
set -euo pipefail
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const key = process.env.OPENROUTER_API_KEY;
const proxy = process.env.OPENROUTER_HTTPS_PROXY?.trim();
if (!key) {
  console.log("probe", "no_key");
  process.exit(2);
}
console.log("probe", "proxy_set", Boolean(proxy));

async function viaFetch(label, useProxy) {
  const started = Date.now();
  try {
    let res;
    if (useProxy && proxy) {
      const undiciPath = "/app/node_modules/.pnpm/undici@7.30.1/node_modules/undici/index.js";
      const mod = await import(undiciPath).catch(() => import("undici"));
      const { ProxyAgent, fetch: ufetch } = mod;
      res = await ufetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        dispatcher: new ProxyAgent(proxy),
      });
    } else {
      res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
      });
    }
    const t = await res.text();
    console.log(label, "status", res.status, "ms", Date.now() - started, "prefix", t.slice(0, 80).replace(/\s+/g, " "));
  } catch (e) {
    console.log(label, "error", e instanceof Error ? e.message : String(e), "ms", Date.now() - started);
  }
}

await viaFetch("direct", false);
await viaFetch("proxy", true);
NODE
