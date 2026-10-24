#!/usr/bin/env bash
set -euo pipefail
docker exec ai-shotbro-staging-api-1 node <<'NODE'
const bad = "legacy-compromised-value";
fetch("http://127.0.0.1:3001/api/v1/internal/integration-users/provision", {
  method: "POST",
  headers: { "X-Shotbro-Integration-Provision": bad },
})
  .then((r) => {
    console.log("wrong_secret_status", r.status);
    if (r.status === 200) process.exit(1);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
NODE
