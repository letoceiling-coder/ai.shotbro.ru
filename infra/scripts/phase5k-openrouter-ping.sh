#!/usr/bin/env bash
# Minimal OpenRouter chat ping (usage only, no secrets logged).
set -euo pipefail
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_DEFAULT_MODEL || "openai/gpt-4o-mini";
if (!key) {
  console.error("no_key");
  process.exit(2);
}
const body = {
  model,
  messages: [{ role: "user", content: "Ответь одним словом: ок" }],
  max_tokens: 16,
};
fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "https://ai.shotbro.ru",
    "X-Title": "SHOTBRO Phase5K Ping",
  },
  body: JSON.stringify(body),
})
  .then(async (r) => {
    const text = await r.text();
    console.log("http_status", r.status);
    if (r.status >= 400) {
      console.log("body_prefix", text.slice(0, 200).replace(/\s+/g, " "));
      process.exit(1);
    }
    const data = JSON.parse(text);
    const usage = data.usage || {};
    console.log(
      "usage",
      JSON.stringify({
        input: usage.prompt_tokens ?? 0,
        output: usage.completion_tokens ?? 0,
        total: usage.total_tokens ?? 0,
      }),
    );
    const msg = data.choices?.[0]?.message?.content;
    console.log("reply_prefix", String(msg ?? "").slice(0, 40));
  })
  .catch((e) => {
    console.error("fetch_error", e.message);
    process.exit(1);
  });
NODE
echo PHASE5K_OPENROUTER_PING_PASS
