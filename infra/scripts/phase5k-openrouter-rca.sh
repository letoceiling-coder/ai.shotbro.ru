#!/usr/bin/env bash
# OpenRouter connectivity RCA from API container (no secrets in output).
set -euo pipefail

CONTAINER="${OPENROUTER_RCA_CONTAINER:-ai-shotbro-staging-api-1}"

echo "phase5k_rca container=${CONTAINER}"

docker exec "$CONTAINER" sh -c 'getent hosts openrouter.ai | head -1 || echo dns_fail'

docker exec -i "$CONTAINER" node <<'NODE'
const key = process.env.OPENROUTER_API_KEY;
const proxy =
  process.env.OPENROUTER_HTTPS_PROXY?.trim() ||
  process.env.HTTPS_PROXY?.trim() ||
  process.env.https_proxy?.trim();

console.log("key_present", Boolean(key && key.length > 20));
console.log("proxy_configured", Boolean(proxy));
console.log("connect_mode", process.env.OPENROUTER_CONNECT_MODE ?? "auto");
console.log("llm_live", process.env.LLM_LIVE_EXECUTION_ENABLED);
console.log("openrouter_enabled", process.env.OPENROUTER_ENABLED);

async function tryFetch(label, url, init) {
  const started = Date.now();
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    console.log(label, "status", res.status, "ms", Date.now() - started, "bytes", text.length);
    if (res.status >= 400) {
      console.log(label, "body_prefix", text.slice(0, 160).replace(/\s+/g, " "));
    }
    return res.status;
  } catch (e) {
    console.log(label, "error", e instanceof Error ? e.message : String(e), "ms", Date.now() - started);
    return 0;
  }
}

async function main() {
  if (!key) {
    console.log("rca_abort", "missing_key");
    process.exit(2);
  }
  const auth = { Authorization: `Bearer ${key}` };
  await tryFetch("direct_models", "https://openrouter.ai/api/v1/models", { headers: auth });

  if (proxy) {
    try {
      const { ProxyAgent, fetch: ufetch } = await import("/app/node_modules/undici/index.js");
      const agent = new ProxyAgent(proxy);
      const started = Date.now();
      const res = await ufetch("https://openrouter.ai/api/v1/models", {
        headers: auth,
        dispatcher: agent,
      });
      const text = await res.text();
      console.log("proxy_models", "status", res.status, "ms", Date.now() - started, "bytes", text.length);
    } catch (e) {
      console.log("proxy_models", "error", e instanceof Error ? e.message : String(e));
    }
  }

  const miniBody = {
    model: process.env.OPENROUTER_DEFAULT_MODEL || "openai/gpt-4o-mini",
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 8,
  };
  await tryFetch("direct_chat", "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(miniBody),
  });
}

main().catch((e) => {
  console.error("rca_fatal", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
NODE

echo "phase5k_rca_done"
