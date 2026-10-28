import { describe, expect, it } from "vitest";
import { creativeTurnIdempotencyStorageKey } from "../../src/agent/agent.service";

describe("creative-turn idempotency keys (5L-A)", () => {
  it("scopes by user and project", () => {
    const a = creativeTurnIdempotencyStorageKey("u1", "p1", "k1");
    const b = creativeTurnIdempotencyStorageKey("u2", "p1", "k1");
    const c = creativeTurnIdempotencyStorageKey("u1", "p2", "k1");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe("creative-turn:u1:p1:k1");
  });
});
