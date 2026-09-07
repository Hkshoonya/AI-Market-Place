import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

interface WorkerRequest {
  url: string;
  method: string;
  destination: string;
  mode: string;
}

function workerHarness() {
  const handlers = new Map<string, (event: unknown) => void>();
  const fetch = vi.fn().mockResolvedValue(new Response("network"));
  const cache = { put: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(undefined),
  };

  runInNewContext(readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8"), {
    self: {
      location: { origin: "https://aimarketcap.tech" },
      addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
    },
    fetch,
    caches,
    URL,
    Response,
  });

  function dispatch(overrides: Partial<WorkerRequest> = {}) {
    const request: WorkerRequest = {
      url: "https://aimarketcap.tech/pricing",
      method: "GET",
      destination: "document",
      mode: "navigate",
      ...overrides,
    };
    const respondWith = vi.fn();
    handlers.get("fetch")!({ request, respondWith });
    return { request, respondWith };
  }

  return { dispatch, fetch, caches, cache };
}

describe("public service worker", () => {
  it.each([
    ["https://static.cloudflareinsights.com/beacon.min.js", "script"],
    ["https://cdn.example.com/style.css", "style"],
    ["https://images.example.com/avatar.png", "image"],
    ["https://aimarketcap.tech.example.com/script.js", "script"],
    ["http://aimarketcap.tech/script.js", "script"],
  ])("leaves external requests to %s to the browser", (url, destination) => {
    const worker = workerHarness();
    const event = worker.dispatch({ url, destination, mode: "cors" });
    expect(event.respondWith).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
    expect(worker.caches.open).not.toHaveBeenCalled();
  });

  it.each(["/api/health", "/auth/callback"])("does not intercept sensitive path %s", (path) => {
    const worker = workerHarness();
    expect(worker.dispatch({ url: `https://aimarketcap.tech${path}` }).respondWith).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("does not intercept analytics submissions or other non-GET requests", () => {
    const worker = workerHarness();
    expect(worker.dispatch({ url: "https://aimarketcap.tech/cdn-cgi/rum", method: "POST" }).respondWith).not.toHaveBeenCalled();
    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("preserves network-first navigation and the offline fallback", async () => {
    const worker = workerHarness();
    const online = worker.dispatch();
    expect(await (await online.respondWith.mock.calls[0][0]).text()).toBe("network");
    expect(worker.cache.put).not.toHaveBeenCalled();

    worker.fetch.mockRejectedValueOnce(new Error("offline"));
    worker.caches.match.mockImplementation(async (key) => key === "/offline" ? new Response("offline page") : undefined);
    const offline = worker.dispatch();
    expect(await (await offline.respondWith.mock.calls[0][0]).text()).toBe("offline page");
  });

  it("keeps caching same-origin images but not code bundles", async () => {
    const worker = workerHarness();
    const image = worker.dispatch({ url: "https://aimarketcap.tech/logo.png", destination: "image", mode: "no-cors" });
    await image.respondWith.mock.calls[0][0];
    expect(worker.cache.put).toHaveBeenCalledWith(image.request, expect.any(Response));

    worker.cache.put.mockClear();
    const script = worker.dispatch({ url: "https://aimarketcap.tech/_next/static/chunk.js", destination: "script", mode: "no-cors" });
    await script.respondWith.mock.calls[0][0];
    expect(worker.cache.put).not.toHaveBeenCalled();
  });
});
