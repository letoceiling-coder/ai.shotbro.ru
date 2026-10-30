const base = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Absolute URL of an API path (for <audio>/<video> src that the browser loads itself). */
export function apiUrl(path: string) {
  return `${base}${path}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const retryAfter = Number(res.headers.get("retry-after"));
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined, body);
  }
  return res.json();
}

/** HTTP error with status so React Query can retry rate limits (429) and 5xx, but not 4xx. */
export class ApiError extends Error {
  /** Server error code (`{ code }` in the body), e.g. `consent_required`, `user_daily_cap_exceeded`. */
  readonly code?: string;
  constructor(
    readonly status: number,
    readonly retryAfterMs?: number,
    readonly body?: unknown,
  ) {
    super(`API ${status}`);
    this.name = "ApiError";
    const b = body as { code?: unknown; message?: unknown } | undefined;
    // Nest wraps HttpException objects as-is, so `code` sits at the top level.
    if (b && typeof b.code === "string") this.code = b.code;
    else if (b && b.message && typeof (b.message as { code?: unknown }).code === "string") {
      this.code = (b.message as { code: string }).code;
    }
  }
}

const RETRYABLE_ATTEMPTS = 6;

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status >= 500) return failureCount < RETRYABLE_ATTEMPTS;
    return false;
  }
  return failureCount < 3;
}

export function queryRetryDelay(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.retryAfterMs) return Math.min(error.retryAfterMs, 60_000);
  return Math.min(1000 * 2 ** attempt, 15_000);
}

export const api = {
  me: () => apiFetch("/api/v1/users/me"),
  projects: {
    list: (cursor?: string) => apiFetch(`/api/v1/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
    create: (body: { title: string; description?: string; settings?: Record<string, unknown> }) =>
      apiFetch("/api/v1/projects", { method: "POST", body: JSON.stringify(body) }),
    get: (id: string) => apiFetch(`/api/v1/projects/${id}`),
    patch: (id: string, body: { title?: string; description?: string; settings?: Record<string, unknown> }) =>
      apiFetch(`/api/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  },
  uploads: {
    init: (body: { projectId: string; filename: string; mimeType: string; sizeBytes: number }) =>
      apiFetch("/api/v1/uploads/init", { method: "POST", body: JSON.stringify(body) }),
    complete: (sessionId: string, body?: { parts?: Array<{ partNumber: number; etag: string }> }) =>
      apiFetch(`/api/v1/uploads/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
  },
  assets: {
    list: (projectId: string) => apiFetch(`/api/v1/projects/${projectId}/assets`),
  },
  ai: {
    registry: () => apiFetch("/api/v1/ai/registry"),
  },
  agent: {
    createRun: (projectId: string, body: { userRequest: string; conversationId?: string }) =>
      apiFetch(`/api/v1/projects/${projectId}/agent/runs`, { method: "POST", body: JSON.stringify(body) }),
    creativeTurn: (
      projectId: string,
      body: { userMessage: string; conversationId: string; idempotencyKey?: string },
    ) => apiFetch(`/api/v1/projects/${projectId}/agent/creative-turn`, { method: "POST", body: JSON.stringify(body) }),
    listRuns: (projectId: string) => apiFetch(`/api/v1/projects/${projectId}/agent/runs`),
    resume: (projectId: string, runId: string) =>
      apiFetch(`/api/v1/projects/${projectId}/agent/runs/${runId}/resume`, { method: "POST", body: "{}" }),
  },
  approvals: {
    list: (projectId: string) =>
      apiFetch(`/api/v1/projects/${projectId}/approvals`) as Promise<{
        items: Array<{ id: string; status: string; targetType?: string; targetVersion?: string }>;
      }>,
    create: (
      projectId: string,
      body: {
        conversationId: string;
        title: string;
        description?: string;
        targetType: string;
        targetId: string;
        targetVersion: string;
        payload?: Record<string, unknown>;
      },
    ) =>
      apiFetch(`/api/v1/projects/${projectId}/approvals`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    decide: (
      approvalId: string,
      action: "approve" | "reject" | "request-revision",
      body: { expectedVersion: string; payloadHash: string; idempotencyKey?: string },
    ) =>
      apiFetch(
        `/api/v1/approvals/${approvalId}/${action === "request-revision" ? "request-revision" : action}`,
        {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
};
