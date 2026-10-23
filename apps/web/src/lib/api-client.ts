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
