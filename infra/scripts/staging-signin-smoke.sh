#!/usr/bin/env bash
set -euo pipefail
# Sign-in smoke for A/B inside API container (passwords from container env, not logged).
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
async function trySignIn(label, email, password) {
  const res = await fetch("http://127.0.0.1:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://ai.shotbro.ru" },
    body: JSON.stringify({ email, password }),
  });
  const ok = res.ok;
  console.log(JSON.stringify({ user: label, status: res.status, ok }));
  if (!ok) process.exitCode = 1;
}
const aEmail = process.env.INTEGRATION_USER_A_EMAIL ?? "e2e-phase2@shotbro.test";
const bEmail = process.env.INTEGRATION_USER_B_EMAIL ?? "e2e-phase2-b@shotbro.test";
const aPass = process.env.INTEGRATION_USER_A_PASSWORD ?? process.env.E2E_TEST_PASSWORD;
const bPass = process.env.INTEGRATION_USER_B_PASSWORD ?? aPass;
if (!aPass || !bPass) {
  console.error("missing integration passwords in container env");
  process.exit(1);
}
await trySignIn("A", aEmail, aPass);
await trySignIn("B", bEmail, bPass);
NODE
