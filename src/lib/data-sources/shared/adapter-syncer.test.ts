/**
 * Unit tests for data-sources/shared/adapter-syncer.ts
 *
 * PIPE-06 verification: healthCheck() is implemented on createAdapterSyncer adapters
 *
 * Covers:
 * 1. healthCheck returns { healthy: true, latencyMs: number } when endpoint responds 200
 * 2. healthCheck returns { healthy: false } when endpoint returns non-OK status
 * 3. healthCheck returns { healthy: false } when fetch throws (network error)
 * 4. healthCheck returns static-only message when no API key is provided
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createAdapterSyncer } from "./adapter-syncer";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeConfig() {
  return {
    apiKeySecret: "TEST_API_KEY",
    apiSourceName: "test_api",
    knownModelIds: ["model-a", "model-b"],
    buildRecordFn: (id: string) => ({ slug: id, name: id }),
    staticModelCount: 2,
    scrapeFn: async () => [] as string[],
    apiFn: async () => null,
    enrichFn: () => undefined,
    healthCheckUrl: "https://api.example.com/models",
    healthCheckHeaders: (apiKey: string) => ({ Authorization: `Bearer ${apiKey}` }),
    healthCheckSuccessMsg: "API reachable",
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createAdapterSyncer — healthCheck (PIPE-06)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TEST_API_KEY;
  });

  it("returns healthy: true with latencyMs when endpoint responds 200", async () => {
    process.env.TEST_API_KEY = "test-key-abc";

    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const { healthCheck } = createAdapterSyncer(makeConfig());
    const result = await healthCheck({ TEST_API_KEY: "test-key-abc" });

    expect(result.healthy).toBe(true);
    expect(typeof result.latencyMs).toBe("number");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.message).toBe("API reachable");
  });

  it("returns healthy: false when endpoint returns non-OK status (e.g. 401)", async () => {
    process.env.TEST_API_KEY = "bad-key";

    const mockFetch = vi.fn().mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const { healthCheck } = createAdapterSyncer(makeConfig());
    const result = await healthCheck({ TEST_API_KEY: "bad-key" });

    expect(result.healthy).toBe(false);
    expect(result.message).toContain("401");
  });

  it("returns healthy: false when fetch throws (network error)", async () => {
    process.env.TEST_API_KEY = "test-key";

    const mockFetch = vi.fn().mockRejectedValue(new Error("Network unreachable"));
    vi.stubGlobal("fetch", mockFetch);

    const { healthCheck } = createAdapterSyncer(makeConfig());
    const result = await healthCheck({ TEST_API_KEY: "test-key" });

    expect(result.healthy).toBe(false);
    expect(result.message).toContain("Network unreachable");
  });

  it("returns healthy: true in static-only mode when no API key provided", async () => {
    delete process.env.TEST_API_KEY;

    const { healthCheck } = createAdapterSyncer(makeConfig());
    const result = await healthCheck({});

    expect(result.healthy).toBe(true);
    expect(result.latencyMs).toBe(0);
    expect(result.message).toContain("Static-only mode");
    expect(result.message).toContain("2");
  });

  it("healthCheck uses function-form healthCheckUrl when provided", async () => {
    process.env.TEST_API_KEY = "my-api-key";

    const mockFetch = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200 })
    );
    vi.stubGlobal("fetch", mockFetch);

    const config = {
      ...makeConfig(),
      healthCheckUrl: (key: string) => `https://api.example.com/models?key=${key}`,
      healthCheckHeaders: () => ({}) as Record<string, string>,
    };

    const { healthCheck } = createAdapterSyncer(config);
    await healthCheck({ TEST_API_KEY: "my-api-key" });

    const firstCallUrl = mockFetch.mock.calls[0]?.[0];
    expect(firstCallUrl).toBe("https://api.example.com/models?key=my-api-key");
  });
});
