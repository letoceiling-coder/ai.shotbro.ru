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

export class MockHttpTransport implements HttpTransport {
  constructor(private readonly fixtures: Record<string, HttpResponse>) {}

  async request(req: HttpRequest): Promise<HttpResponse> {
    const key = `${req.method} ${req.url}`;
    const hit = this.fixtures[key];
    if (!hit) throw new Error(`No mock fixture for ${key}`);
    return hit;
  }
}
