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
import * as utils from "../utils";

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

  it("reports unhealthy when neither live API nor public discovery is available", async () => {
    delete process.env.TEST_API_KEY;

    const { healthCheck } = createAdapterSyncer(makeConfig());
    const result = await healthCheck({});

    expect(result.healthy).toBe(false);
    expect(result.message).toContain("Live discovery unavailable");
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

describe("createAdapterSyncer — stale provider row cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deactivates active provider rows that are no longer emitted", async () => {
    vi.spyOn(utils, "upsertBatch").mockResolvedValue({
      created: 0,
      errors: [],
    });

    const staleRows = [{ slug: "test-stale-docs-slug" }, { slug: "test-future-model" }, { slug: "model-a" }];
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      like: vi.fn().mockResolvedValue({ data: staleRows, error: null }),
    };
    const updateChain = {
      in: vi.fn().mockResolvedValue({ error: null }),
    };
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table !== "models") throw new Error(`Unexpected table ${table}`);
        return {
          select: vi.fn(() => selectChain),
          update: vi.fn(() => updateChain),
        };
      }),
    };

    const { sync } = createAdapterSyncer({
      ...makeConfig(),
      scrapeFn: async () => ["model-a"],
      deactivateMissing: {
        provider: "Test Provider",
        slugPrefix: "test",
        shouldDeactivateSlug: (slug) => slug === "test-stale-docs-slug",
      },
    });

    const result = await sync({
      supabase: mockSupabase as never,
      config: {},
      secrets: {},
      lastSyncAt: null,
    });

    expect(updateChain.in).toHaveBeenCalledWith("slug", [
      "test-stale-docs-slug",
    ]);
    expect(result.success).toBe(true);
    expect(result.metadata?.deactivatedStale).toBe(1);
  });
});

describe("createAdapterSyncer — public docs lifecycle enrichment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies verified scrape overrides to an existing static model", async () => {
    let persistedRecords: Array<Record<string, unknown>> = [];
    vi.spyOn(utils, "upsertBatch").mockImplementation(
      async (_supabase, _table, records) => {
        persistedRecords = records;
        return { created: 0, errors: [] };
      }
    );

    const { sync } = createAdapterSyncer({
      ...makeConfig(),
      knownModelIds: ["model-a"],
      staticModelCount: 1,
      buildRecordFn: (id, overrides = {}) => ({
        slug: id,
        name: id,
        status: "active",
        ...overrides,
      }),
      scrapeFn: async () => [
        { id: "model-a", overrides: { status: "preview" } },
      ],
    });

    const result = await sync({
      supabase: {} as never,
      config: {},
      secrets: {},
      lastSyncAt: null,
    });

    expect(result.success).toBe(true);
    expect(persistedRecords).toEqual([
      expect.objectContaining({ slug: "model-a", status: "preview" }),
    ]);
  });
});

describe("createAdapterSyncer discovery safeguards", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not archive anything during a static-only fallback", async () => {
    vi.spyOn(utils, "upsertBatch").mockResolvedValue({ created: 0, errors: [] });
    const from = vi.fn();
    const { sync } = createAdapterSyncer({ ...makeConfig(), deactivateMissing: {
      provider: "Test", slugPrefix: "test", shouldDeactivateSlug: () => true,
    } });
    const result = await sync({ supabase: { from } as never, config: {}, secrets: {}, lastSyncAt: null });
    expect(from).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.metadata).toMatchObject({ discoveryHealthy: false, deactivatedStale: 0 });
  });

  it.each([[], new Map()])("does not treat an empty API collection as fresh discovery: %s", async (collection) => {
    vi.spyOn(utils, "upsertBatch").mockResolvedValue({ created: 0, errors: [] });
    const from = vi.fn();
    const { sync } = createAdapterSyncer({ ...makeConfig(), apiFn: async () => collection,
      deactivateMissing: { provider: "Test", slugPrefix: "test", shouldDeactivateSlug: () => true },
    });
    const result = await sync({ supabase: { from } as never, config: {},
      secrets: { TEST_API_KEY: "local-test-only" }, lastSyncAt: null });
    expect(from).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.metadata).toMatchObject({ discoveryHealthy: false, apiModels: 0, deactivatedStale: 0 });
  });

  it("omits empty and inferred metadata on existing ID-only models, but names new rows", async () => {
    const upsert = vi.spyOn(utils, "upsertBatch").mockResolvedValue({ created: 0, errors: [] });
    const query = { in: vi.fn().mockResolvedValue({ data: [{ slug: "future-1", name: "Future 1", category: "multimodal" }], error: null }) };
    const { sync } = createAdapterSyncer({ ...makeConfig(), knownModelIds: [], preserveDiscoveredMetadata: true,
      scrapeFn: async () => ["future-1", "future-2"],
      buildRecordFn: (id) => ({ slug: id, name: id, category: "llm", modalities: ["text"], description: null,
        context_window: null, release_date: null, website_url: null, capabilities: {}, status: "active" }),
    });
    const result = await sync({ supabase: { from: () => ({ select: () => query }) } as never,
      config: {}, secrets: {}, lastSyncAt: null });
    expect(result.success).toBe(true);
    expect(upsert.mock.calls[0][2]).toEqual([
      { slug: "future-1", name: "Future 1", category: "multimodal", status: "active" },
      { slug: "future-2", name: "future-2", category: "llm", modalities: ["text"], status: "active" },
    ]);
  });

  it("fails closed when existing identities cannot be read", async () => {
    const upsert = vi.spyOn(utils, "upsertBatch");
    const { sync } = createAdapterSyncer({ ...makeConfig(), preserveDiscoveredMetadata: true,
      scrapeFn: async () => ["future-1"],
    });
    const result = await sync({ supabase: { from: () => ({ select: () => ({ in: async () => ({ error: { message: "offline" } }) }) }) } as never,
      config: {}, secrets: {}, lastSyncAt: null });
    expect(result.success).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
