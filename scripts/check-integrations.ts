#!/usr/bin/env tsx
/**
 * SHOTBRO integration checker — never logs secret values.
 * Usage:
 *   pnpm integrations:check -- --offline
 *   pnpm integrations:check -- --live
 *   pnpm integrations:check -- --live --smtp-test   (explicit test email — not run by default)
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvForOfflineCheck } from "@shotbro/config/env";
import { getOpenRouterConfig, validateOpenRouterKeyPresent } from "@shotbro/config/openrouter";
import { createS3Client, runS3LiveChecks } from "@shotbro/config/s3";
import { describeSmtpMode } from "@shotbro/config/smtp";
import { maskSecret, redactEnvKey } from "@shotbro/config/redact";
import { verifySmtpConnection } from "@shotbro/email/transport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.production");

function loadEnvFile(): Record<string, string | undefined> {
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: true });
  } else {
    console.warn(`⚠  ${envPath} not found — using process.env only`);
  }
  return { ...process.env };
}

function printPresence(raw: Record<string, string | undefined>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    const present = Boolean(value && value.trim().length > 0);
    const detail = redactEnvKey(key) ? maskSecret(value) : present ? "set" : "(empty)";
    console.log(`${present ? "✓" : "✗"} ${key}: ${detail}`);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const live = args.has("--live");
  const smtpTest = args.has("--smtp-test");

  if (live) {
    console.log("Live mode: S3/SMTP checks only. OpenRouter API calls are never performed in Phase 2.\n");
  } else {
    console.log("Offline mode: format and presence checks only.\n");
  }

  const raw = loadEnvFile();
  const { ok, errors, warnings, env } = loadEnvForOfflineCheck(raw);

  printPresence(raw, [
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "OPENROUTER_API_KEY",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
  ]);

  console.log(`\nFlags: OPENROUTER_ENABLED=${raw.OPENROUTER_ENABLED ?? "false"}, EMAIL_ENABLED=${raw.EMAIL_ENABLED ?? "false"}`);

  if (env) {
    console.log(`SMTP mode: ${describeSmtpMode(env)}`);
    const orKey = validateOpenRouterKeyPresent(env.OPENROUTER_API_KEY);
    console.log(`OpenRouter key: ${orKey.detail}`);
    const orCfg = getOpenRouterConfig(env);
    console.log(
      `OpenRouter runtime: enabled=${orCfg.enabled}, allowPaid=${orCfg.allowPaidRequests}, maxCostUsd=${orCfg.maxCostUsd}`,
    );
  }

  for (const w of warnings) console.warn(`⚠  ${w}`);
  for (const e of errors) console.error(`✗  ${e}`);

  if (!ok) {
    console.error("\nOffline validation failed.");
    process.exitCode = 1;
    if (!live) return;
  } else {
    console.log("\nOffline validation passed.");
  }

  if (!live || !env) return;

  console.log("\n— S3 live checks —");
  if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    console.error("  S3 credentials missing — skip live S3");
    process.exitCode = 1;
    return;
  }
  const client = createS3Client({
    ...env,
    S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
  });
  const s3 = await runS3LiveChecks(client, env.S3_BUCKET, env.S3_PRESIGNED_URL_TTL_SECONDS);
  for (const m of s3.messages) console.log(`  ${m}`);

  const s3Ok =
    s3.headBucket && s3.putObject && s3.getObject && s3.deleteObject && s3.presignedUrl;
  if (!s3Ok) process.exitCode = 1;

  console.log("\n— SMTP live checks —");
  if (!env.EMAIL_ENABLED) {
    console.log("  EMAIL_ENABLED=false — connection verify skipped");
  } else {
    const smtp = await verifySmtpConnection(env);
    console.log(`  ${smtp.detail}`);
    if (!smtp.ok) process.exitCode = 1;
    if (smtpTest) {
      console.warn("  --smtp-test requested: implement recipient in Phase 3 with owner confirmation");
    }
  }

  console.log("\n— OpenRouter —");
  console.log("  No API requests (Phase 2 policy).");
}

main().catch(() => {
  console.error("Integration check failed (details redacted).");
  process.exitCode = 1;
});
