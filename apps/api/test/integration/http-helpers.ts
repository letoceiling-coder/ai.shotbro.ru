import { expect } from "vitest";

const base = process.env.INTEGRATION_API_URL ?? "http://127.0.0.1:3021";
const gate = process.env.STAGING_GATE_SECRET;

export type AuthSession = { cookie: string; userId: string; email: string };

function headers(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { ...extra };
  if (gate) h["X-Shotbro-Staging-Gate"] = gate;
  return h;
}

export async function signUp(email: string, password: string, name: string): Promise<AuthSession> {
  const res = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: headers({
      "Content-Type": "application/json",
      Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru",
    }),
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`signUp ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  const body = (await res.json()) as { user: { id: string; email: string } };
  return { cookie, userId: body.user.id, email: body.user.email };
}

export async function apiJson<T>(
  path: string,
  session: AuthSession,
  init: RequestInit = {},
): Promise<{ status: number; json: T }> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: headers({
      "Content-Type": "application/json",
      Cookie: session.cookie,
      ...(init.headers as Record<string, string>),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, json };
}

export async function apiRaw(path: string, session: AuthSession, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: headers({ Cookie: session.cookie, ...(init.headers as Record<string, string>) }),
  });
}

/** Apply Better Auth Set-Cookie from sign-out (cleared tokens) so follow-up requests do not reuse old session. */
export async function signOut(session: AuthSession): Promise<void> {
  const res = await fetch(`${base}/api/auth/sign-out`, {
    method: "POST",
    headers: headers({
      Cookie: session.cookie,
      Origin: process.env.INTEGRATION_ORIGIN ?? "https://ai.shotbro.ru",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`signOut ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  session.cookie = "";
}

export function requireIntegrationEnv() {
  if (process.env.RUN_INTEGRATION_TESTS !== "1") {
    throw new Error("Set RUN_INTEGRATION_TESTS=1 to run integration tests");
  }
}

export function expectOk2xx(status: number) {
  expect(status).toBeGreaterThanOrEqual(200);
  expect(status).toBeLessThan(300);
}
