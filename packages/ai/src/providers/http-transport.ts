import { ProxyAgent, fetch as undiciFetch } from "undici";

export type HttpRequest = {
  method: "GET" | "POST" | "DELETE";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

export interface HttpTransport {
  request(req: HttpRequest): Promise<HttpResponse>;
}

/** Phase 4 default — no outbound network. */
export class BlockedHttpTransport implements HttpTransport {
  async request(_req: HttpRequest): Promise<HttpResponse> {
    throw new Error("HTTP transport blocked by execution policy");
  }
}

function proxyUrlFromEnv(): string | undefined {
  return (
    process.env.OPENROUTER_HTTPS_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.https_proxy?.trim() ||
    undefined
  );
}

/** direct → proxy (when auto) or proxy → direct; never logs secrets. */
function connectModes(): Array<"direct" | "proxy"> {
  const mode = (process.env.OPENROUTER_CONNECT_MODE ?? "auto").toLowerCase();
  const proxy = proxyUrlFromEnv();
  if (mode === "direct") return ["direct"];
  if (mode === "proxy") return proxy ? ["proxy", "direct"] : ["direct"];
  // auto: prefer direct egress; fall back to proxy if configured
  return proxy ? ["direct", "proxy"] : ["direct"];
}

async function performFetch(
  req: HttpRequest,
  via: "direct" | "proxy",
  proxyUrl: string | undefined,
  signal: AbortSignal,
) {
  const init = {
    method: req.method,
    headers: req.headers,
    body: req.body != null ? JSON.stringify(req.body) : undefined,
    signal,
  };
  if (via === "proxy" && proxyUrl) {
    const dispatcher = new ProxyAgent(proxyUrl);
    return undiciFetch(req.url, { ...init, dispatcher });
  }
  return undiciFetch(req.url, init);
}

/** Node fetch — used only when creative LLM policy allows outbound calls. */
export class FetchHttpTransport implements HttpTransport {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 60_000);
    const proxyUrl = proxyUrlFromEnv();
    const modes = connectModes();
    let lastError: Error | undefined;

    try {
      for (const via of modes) {
        try {
          const res = await performFetch(req, via, proxyUrl, ctrl.signal);
          const text = await res.text();
          let body: unknown = text;
          try {
            body = JSON.parse(text);
          } catch {
            /* plain text */
          }
          const headers: Record<string, string> = {};
          res.headers.forEach((v, k) => {
            headers[k] = v;
          });
          if (via === "proxy" || modes.length > 1) {
            headers["x-shotbro-connect-via"] = via;
          }
          const policyBlocked =
            res.status === 403 &&
            typeof body === "object" &&
            body !== null &&
            String((body as { error?: string }).error ?? "").toLowerCase().includes("security policy");
          if (policyBlocked && via === "direct" && modes.includes("proxy")) {
            continue;
          }
          return { status: res.status, headers, body };
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
      }
      throw lastError ?? new Error("HTTP request failed");
    } finally {
      clearTimeout(timer);
    }
  }
}

export class MockHttpTransport implements HttpTransport {
  constructor(private readonly fixtures: Record<string, HttpResponse>) {}

  async request(req: HttpRequest): Promise<HttpResponse> {
    const key = `${req.method} ${req.url}`;
    const hit = this.fixtures[key];
    if (!hit) throw new Error(`No mock fixture for ${key}`);
    return hit;
  }
}
