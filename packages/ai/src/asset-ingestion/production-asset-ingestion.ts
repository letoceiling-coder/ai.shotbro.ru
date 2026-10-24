import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";

export type IngestionLimits = {
  maxBytes: number;
  allowedMimePrefixes: string[];
  allowedHostnames: string[];
};

export type IngestionRequest = {
  projectId: string;
  sourceUrl: string;
  expectedMime?: string;
  ownerId: string;
};

export type IngestionResult = {
  ok: boolean;
  mock?: boolean;
  reason?: string;
  checksum?: string;
  mimeType?: string;
  sizeBytes?: number;
};

const PRIVATE_IP = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|0\.|localhost)/i;

export class ProductionAssetIngestionService {
  constructor(private readonly limits: IngestionLimits) {}

  validateUrl(sourceUrl: string): { ok: true; hostname: string } | { ok: false; reason: string } {
    let parsed: URL;
    try {
      parsed = new URL(sourceUrl);
    } catch {
      return { ok: false, reason: "invalid_url" };
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, reason: "unsupported_protocol" };
    }
    const host = parsed.hostname.toLowerCase();
    if (PRIVATE_IP.test(host) || host === "metadata.google.internal") {
      return { ok: false, reason: "ssrf_private_host" };
    }
    if (this.limits.allowedHostnames.length && !this.limits.allowedHostnames.includes(host)) {
      return { ok: false, reason: "host_not_allowlisted" };
    }
    return { ok: true, hostname: host };
  }

  /** Safe download via injected fetch (contract tests / LIVE_APPROVED only). */
  async ingestFromUrl(
    req: IngestionRequest,
    fetchBytes: (url: string) => Promise<{ bytes: Buffer; mimeType: string; finalUrl: string }>,
  ): Promise<IngestionResult> {
    const check = this.validateUrl(req.sourceUrl);
    if (!check.ok) return { ok: false, reason: check.reason };
    const safe = await this.resolveHostSafety(check.hostname);
    if (!safe) return { ok: false, reason: "ssrf_dns_private" };
    let payload: { bytes: Buffer; mimeType: string; finalUrl: string };
    try {
      payload = await fetchBytes(req.sourceUrl);
    } catch {
      return { ok: false, reason: "download_failed" };
    }
    const finalCheck = this.validateUrl(payload.finalUrl);
    if (!finalCheck.ok) return { ok: false, reason: "redirect_blocked" };
    if (payload.bytes.length > this.limits.maxBytes) return { ok: false, reason: "too_large" };
    const allowed = this.limits.allowedMimePrefixes.some((p) => payload.mimeType.startsWith(p));
    if (!allowed) return { ok: false, reason: "mime_not_allowed" };
    const checksum = createHash("sha256").update(payload.bytes).digest("hex");
    return {
      ok: true,
      checksum,
      mimeType: payload.mimeType,
      sizeBytes: payload.bytes.length,
    };
  }

  /** Mock/fixture ingestion — no network fetch in Phase 4B default. */
  async ingestFromFixture(req: IngestionRequest, fixture: { bytes: Buffer; mimeType: string }): Promise<IngestionResult> {
    const check = this.validateUrl(req.sourceUrl);
    if (!check.ok) return { ok: false, reason: check.reason };
    if (fixture.bytes.length > this.limits.maxBytes) return { ok: false, reason: "too_large" };
    const allowed = this.limits.allowedMimePrefixes.some((p) => fixture.mimeType.startsWith(p));
    if (!allowed) return { ok: false, reason: "mime_not_allowed" };
    const checksum = createHash("sha256").update(fixture.bytes).digest("hex");
    return {
      ok: true,
      mock: true,
      checksum,
      mimeType: fixture.mimeType,
      sizeBytes: fixture.bytes.length,
    };
  }

  /** Guard against DNS rebinding — resolve and reject private IPs (test hook). */
  async resolveHostSafety(hostname: string): Promise<boolean> {
    const host = hostname.toLowerCase();
    if (this.limits.allowedHostnames.includes(host)) return true;
    try {
      const records = await lookup(hostname, { all: true });
      const addrs = records.map((r) => r.address);
      return !addrs.some((a) => PRIVATE_IP.test(a));
    } catch {
      return false;
    }
  }
}
