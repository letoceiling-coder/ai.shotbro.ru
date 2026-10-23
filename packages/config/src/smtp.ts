import type { AppEnv } from "./env.js";

export type SmtpTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  from: { name: string; address: string };
};

export function getSmtpTransportConfig(env: AppEnv): SmtpTransportConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM_EMAIL) {
    return null;
  }
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    from: { name: env.SMTP_FROM_NAME, address: env.SMTP_FROM_EMAIL },
  };
}

export function describeSmtpMode(env: Pick<AppEnv, "SMTP_PORT" | "SMTP_SECURE">): string {
  if (env.SMTP_PORT === 465 && env.SMTP_SECURE) return "implicit TLS (465)";
  if (env.SMTP_PORT === 587 && !env.SMTP_SECURE) return "STARTTLS (587)";
  return `port ${env.SMTP_PORT}, secure=${env.SMTP_SECURE}`;
}
