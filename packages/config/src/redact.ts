const SECRET_KEYS = new Set([
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "OPENROUTER_API_KEY",
  "SMTP_PASSWORD",
  "SMTP_USER",
]);

export function redactEnvKey(key: string): boolean {
  return SECRET_KEYS.has(key);
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(empty)";
  return `present (${value.length} chars, value hidden)`;
}

export function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message.replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[REDACTED_OPENROUTER_KEY]").replace(
      /[A-Fa-f0-9]{32}/g,
      "[REDACTED_HEX]",
    );
  }
  return "Unknown error";
}
