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
  },
};
