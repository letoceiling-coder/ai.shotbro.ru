/**
 * Server-side provisioning (preferred on staging). No HTTP; reads secrets from env only.
 * Usage (inside API container): pnpm exec tsx --tsconfig apps/api/tsconfig.json apps/api/scripts/provision-integration-users-cli.ts
 */
import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { IntegrationUsersService } from "../src/internal/integration-users.service";

loadEnv({ path: resolve(process.cwd(), "../../infra/staging.env") });

async function main() {
  if (process.env.INTEGRATION_PROVISION_ENABLED !== "true") {
    console.error("Set INTEGRATION_PROVISION_ENABLED=true in staging.env for this host only");
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const svc = app.get(IntegrationUsersService);
    const results = await svc.provisionAll();
    console.log(JSON.stringify(results.map((r) => ({ slot: r.slot, email: r.email, status: r.status }))));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
