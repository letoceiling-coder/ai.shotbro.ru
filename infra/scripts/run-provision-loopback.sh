#!/usr/bin/env bash
set -euo pipefail
docker exec -i ai-shotbro-staging-api-1 node <<'NODE'
const secret = process.env.INTEGRATION_PROVISION_SECRET;
if (!secret) {
  console.error("INTEGRATION_PROVISION_SECRET missing in API container");
  process.exit(1);
}
fetch("http://127.0.0.1:3001/api/v1/internal/integration-users/provision", {
  method: "POST",
  headers: { "X-Shotbro-Integration-Provision": secret },
})
  .then(async (r) => {
    const t = await r.text();
    if (!r.ok) {
      console.error("provision failed", r.status, t.slice(0, 200));
      process.exit(1);
    }
    console.log(t);
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
NODE
