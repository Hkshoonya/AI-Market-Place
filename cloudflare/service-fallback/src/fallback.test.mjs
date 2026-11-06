import test from "node:test";
import assert from "node:assert/strict";
import { proxyWithFallback } from "./fallback.mjs";

const navigation = (path = "/models", init) => new Request(`https://aimarketcap.tech${path}`, {
  headers: { Accept: "text/html" }, ...init,
});

test("default transport retains the edge runtime fetch receiver", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async function () {
    assert.equal(this, globalThis);
    return new Response("healthy");
  };
  try {
    assert.equal((await proxyWithFallback(navigation())).status, 200);
  } finally {
    globalThis.fetch = original;
  }
});

test("healthy, redirects and client errors pass through without mutation", async () => {
  for (const status of [200, 302, 401, 403, 404, 429]) {
    const response = new Response("original", { status, headers: { "Set-Cookie": "session=unchanged" } });
    assert.equal(await proxyWithFallback(navigation(), async () => response), response);
  }
});

test("origin errors produce a branded, uncached, safe 503 without leaking diagnostics", async () => {
  for (const status of [500, 502, 503, 504, 521, 522, 524]) {
    const response = await proxyWithFallback(navigation(), async () => new Response("private diagnostics", { status }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Retry-After"), "60");
    const text = await response.text();
    assert.match(text, /AI Market Cap/);
    assert.match(text, /Temporarily unavailable/);
    assert.doesNotMatch(text, /private diagnostics/);
  }
});

test("network failure also renders a fallback, with no automatic retries", async () => {
  let calls = 0;
  const response = await proxyWithFallback(navigation(), async () => { calls++; throw new Error("secret"); });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
  assert.equal(await (await proxyWithFallback(navigation("/", { method: "HEAD", headers: { Accept: "text/html" } }), async () => new Response(null, { status: 502 }))).text(), "");
});

test("API, auth callbacks, RSC, assets and payment mutations retain their original errors", async () => {
  const requests = [navigation("/api/health"), navigation("/auth/callback?code=sensitive"),
    navigation("/_next/static/chunk.js"), navigation("/models", { headers: { Accept: "text/html", RSC: "1" } }),
    navigation("/models", { headers: { Accept: "text/x-component" } }),
    navigation("/checkout", { method: "POST" }), new Request("https://unrelated.test/", { headers: { Accept: "text/html" } })];
  for (const request of requests) {
    const response = new Response("original", { status: 503 });
    assert.equal(await proxyWithFallback(request, async () => response), response);
  }
});
