const base = process.env.NEXT_PUBLIC_API_URL ?? "";

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
    throw new Error(`API ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => apiFetch("/api/v1/users/me"),
  projects: {
    list: (cursor?: string) => apiFetch(`/api/v1/projects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`),
    create: (body: { title: string; description?: string }) =>
      apiFetch("/api/v1/projects", { method: "POST", body: JSON.stringify(body) }),
    patch: (id: string, body: { title?: string; description?: string }) =>
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
  approvals: {
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
