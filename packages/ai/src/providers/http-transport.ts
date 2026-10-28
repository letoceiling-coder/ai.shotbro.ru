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

/** Node fetch — used only when creative LLM policy allows outbound calls. */
export class FetchHttpTransport implements HttpTransport {
  async request(req: HttpRequest): Promise<HttpResponse> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), req.timeoutMs ?? 60_000);
    try {
      const res = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body != null ? JSON.stringify(req.body) : undefined,
        signal: ctrl.signal,
      });
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
      return { status: res.status, headers, body };
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
