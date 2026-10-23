import nodemailer from "nodemailer";
import type { AppEnv } from "@shotbro/config/env";
import { getSmtpTransportConfig } from "@shotbro/config/smtp";
import type { EmailTemplate } from "./templates/index.js";
import { checkEmailRateLimit } from "./tokens.js";

export async function verifySmtpConnection(env: AppEnv): Promise<{ ok: boolean; detail: string }> {
  if (!env.EMAIL_ENABLED) {
    return { ok: true, detail: "EMAIL_ENABLED=false — skipped" };
  }
  const cfg = getSmtpTransportConfig(env);
  if (!cfg) return { ok: false, detail: "SMTP not fully configured" };
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });
  try {
    await transport.verify();
    return { ok: true, detail: "SMTP verify: OK" };
  } catch {
    return { ok: false, detail: "SMTP verify failed (details not logged)" };
  }
}

export async function sendEmail(
  env: AppEnv,
  to: string,
  template: EmailTemplate,
  rateLimitKey: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!env.EMAIL_ENABLED) {
    return { sent: false, reason: "EMAIL_ENABLED=false" };
  }
  if (!checkEmailRateLimit(rateLimitKey, env.EMAIL_RATE_LIMIT_PER_HOUR)) {
    return { sent: false, reason: "rate limit exceeded" };
  }
  const cfg = getSmtpTransportConfig(env);
  if (!cfg) return { sent: false, reason: "SMTP not configured" };

  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });

  await transport.sendMail({
    from: `"${cfg.from.name}" <${cfg.from.address}>`,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  return { sent: true };
}
