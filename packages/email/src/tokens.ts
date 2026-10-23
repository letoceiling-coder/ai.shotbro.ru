import { createHash, randomBytes } from "node:crypto";

/** Store only hashes in DB; raw token sent once in email link */
export function generateEmailToken(): { raw: string; hash: string; expiresAt: Date; ttlMinutes: number } {
  const raw = randomBytes(32).toString("base64url");
  const hash = hashEmailToken(raw);
  const ttlMinutes = 60;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  return { raw, hash, expiresAt, ttlMinutes };
}

export function hashEmailToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export type TokenUseRecord = { usedAt?: Date };

export function assertTokenValid(record: TokenUseRecord, expiresAt: Date, now = new Date()): void {
  if (record.usedAt) throw new Error("Token already used");
  if (now > expiresAt) throw new Error("Token expired");
}

export function markTokenUsed(record: TokenUseRecord): void {
  record.usedAt = new Date();
}

/** In-memory stub for Phase 2 — replace with Redis/DB in API */
const sendCounts = new Map<string, { count: number; windowStart: number }>();

export function checkEmailRateLimit(key: string, maxPerHour: number): boolean {
  const hour = 60 * 60_000;
  const now = Date.now();
  const entry = sendCounts.get(key);
  if (!entry || now - entry.windowStart > hour) {
    sendCounts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= maxPerHour) return false;
  entry.count += 1;
  return true;
}
