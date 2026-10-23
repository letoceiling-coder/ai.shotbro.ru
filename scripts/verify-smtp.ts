#!/usr/bin/env tsx
/**
 * SMTP-only live verify (no S3). Loads secrets/smtp-beget.env if present.
 * Never logs secret values.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFromProcess } from "@shotbro/config/env";
import { describeSmtpMode } from "@shotbro/config/smtp";
import { verifySmtpConnection } from "@shotbro/email/transport";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const smtpEnv = resolve(root, "secrets/smtp-beget.env");

for (const path of [smtpEnv, resolve(root, ".env.production")]) {
  if (existsSync(path)) loadDotenv({ path, override: false });
}

process.env.EMAIL_ENABLED = "true";
if (!process.env.S3_ENDPOINT) process.env.S3_ENDPOINT = "https://example.invalid";
if (!process.env.S3_REGION) process.env.S3_REGION = "us-east-1";
if (!process.env.S3_BUCKET) process.env.S3_BUCKET = "smtp-verify-only";
if (!process.env.S3_ACCESS_KEY_ID) process.env.S3_ACCESS_KEY_ID = "00000000000000000000";
if (!process.env.S3_SECRET_ACCESS_KEY) process.env.S3_SECRET_ACCESS_KEY = "00000000000000000000";

async function main() {
  const env = loadEnvFromProcess();
  console.log(`SMTP mode: ${describeSmtpMode(env)}`);
  console.log(`LEAD_NOTIFY_EMAIL: ${env.LEAD_NOTIFY_EMAIL ? "set" : "(empty)"}`);

  const result = await verifySmtpConnection(env);
  console.log(result.detail);
  process.exit(result.ok ? 0 : 1);
}

void main();
