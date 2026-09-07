/**
 * M4.2 — parseQuery / parseBody helpers. Pins:
 *   - valid input returns { ok: true, data } with the parsed (typed) value
 *   - invalid query returns { ok: false, response: 400 } carrying Zod issues
 *   - invalid JSON body returns 400; malformed JSON body returns 400
 *
 * v0.0.59-3 of NextRequest can be built in the node test environment via its
 * Request ctor — `new NextRequest(url, init)` is supported. We construct one
 * per case with the search params or body we need.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

const { parseQuery, parseBody } = await import("../src/lib/validation.js");

function makeRequest(input: { url?: string; method?: string; body?: unknown } = {}) {
  // Lazy import keeps the test env's module graph light.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { NextRequest } = require("next/server");
  const url = input.url ?? "http://localhost/api/x";
  if (input.body === undefined) return new NextRequest(url, { method: input.method ?? "GET" });
  return new NextRequest(url, {
    method: input.method ?? "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.body),
  });
}

describe("parseQuery (M4.2)", () => {
  const schema = z.object({ limit: z.coerce.number().int().min(1).max(100) });

  it("parses a valid query param", async () => {
    const r = parseQuery(makeRequest({ url: "http://localhost/api/x?limit=10" }), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.limit).toBe(10);
  });

  it("rejects an out-of-range value with 400 + issues", async () => {
    const r = parseQuery(makeRequest({ url: "http://localhost/api/x?limit=999" }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("rejects an unknown key when the schema is strict", async () => {
    const strict = z.object({ limit: z.coerce.number().int() }).strict();
    const r = parseQuery(makeRequest({ url: "http://localhost/api/x?limit=5&evil=1" }), strict);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});

describe("parseBody (M4.2)", () => {
  const schema = z.object({ email: z.string().email(), name: z.string().min(1) });

  it("parses a valid JSON body", async () => {
    const r = await parseBody(makeRequest({ body: { email: "a@b.co", name: "U" } }), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe("a@b.co");
  });

  it("rejects an invalid body with 400 + issues", async () => {
    const r = await parseBody(makeRequest({ body: { email: "nope", name: "U" } }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const { NextRequest } = require("next/server");
    const req = new NextRequest("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ not json",
    });
    const r = await parseBody(req, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(400);
  });
});
