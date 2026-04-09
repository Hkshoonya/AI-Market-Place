/**
 * Unit tests for data-sources/utils.ts
 *
 * Covers:
 * 1. resolveSecrets() - returns { secrets, missing } structured result
 * 2. fetchWithRetry() - retry behavior on 5xx and 429
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  resolveSecrets,
  fetchWithRetry,
  hasPermanentSyncError,
  isPermanentHttpFailure,
  retryOperation,
  upsertBatch,
} from "./utils";

// ────────────────────────────────────────────────────────────────
// resolveSecrets tests
// ────────────────────────────────────────────────────────────────

describe("resolveSecrets", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns empty secrets and empty missing for empty input", () => {
    const result = resolveSecrets([]);
    expect(result).toEqual({ secrets: {}, missing: [] });
  });

  it("returns the value for a present env var", () => {
    process.env.TEST_EXISTING_VAR = "abc123";
    const result = resolveSecrets(["TEST_EXISTING_VAR"]);
    expect(result).toEqual({
      secrets: { TEST_EXISTING_VAR: "abc123" },
      missing: [],
    });
  });

  it("returns missing key when env var is absent", () => {
    delete process.env.TEST_MISSING_VAR;
    const result = resolveSecrets(["TEST_MISSING_VAR"]);
    expect(result).toEqual({ secrets: {}, missing: ["TEST_MISSING_VAR"] });
  });

  it("handles mixed present and missing vars", () => {
    process.env.TEST_PRESENT = "value1";
    delete process.env.TEST_ABSENT;
    const result = resolveSecrets(["TEST_PRESENT", "TEST_ABSENT"]);
    expect(result).toEqual({
      secrets: { TEST_PRESENT: "value1" },
      missing: ["TEST_ABSENT"],
    });
  });

  it("treats empty-string env var as missing", () => {
    process.env.TEST_EMPTY = "";
    const result = resolveSecrets(["TEST_EMPTY"]);
    expect(result).toEqual({ secrets: {}, missing: ["TEST_EMPTY"] });
  });
});

// ────────────────────────────────────────────────────────────────
// fetchWithRetry tests (PIPE-05 verification)
// ────────────────────────────────────────────────────────────────

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns response immediately on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on second attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("error", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", undefined, {
      maxRetries: 3,
      baseDelayMs: 0,
    });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", undefined, {
      maxRetries: 3,
      baseDelayMs: 0,
    });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 404 (client error)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", undefined, {
      maxRetries: 3,
      baseDelayMs: 0,
    });
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("exhausts max retries and returns last failed response", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response("server error", { status: 500 }));
    vi.stubGlobal("fetch", mockFetch);

    const res = await fetchWithRetry("https://example.com/api", undefined, {
      maxRetries: 2,
      baseDelayMs: 0,
    });
    expect(res.status).toBe(500);
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});

describe("retryOperation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries transient failures and eventually succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("502 Bad Gateway"))
      .mockResolvedValueOnce("ok");

    await expect(
      retryOperation(operation, { maxRetries: 2, baseDelayMs: 0 })
    ).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient failures", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new Error("violates foreign key constraint"));

    await expect(
      retryOperation(operation, { maxRetries: 2, baseDelayMs: 0 })
    ).rejects.toThrow("violates foreign key constraint");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe("isPermanentHttpFailure", () => {
  it("treats 404 as permanent", () => {
    expect(isPermanentHttpFailure(404, "not found")).toBe(true);
  });

  it("treats gated 403 responses as permanent", () => {
    expect(isPermanentHttpFailure(403, "The dataset does not exist, or is not accessible without authentication (private or gated).")).toBe(true);
  });

  it("does not treat transient 503 as permanent", () => {
    expect(isPermanentHttpFailure(503, "service unavailable")).toBe(false);
  });
});

describe("hasPermanentSyncError", () => {
  it("returns true when a sync error marks a permanent upstream failure", () => {
    expect(hasPermanentSyncError([
      { message: "upstream gone", context: "permanent_upstream_failure" },
    ])).toBe(true);
  });

  it("returns false for ordinary adapter failures", () => {
    expect(hasPermanentSyncError([
      { message: "timeout", context: "network_error" },
    ])).toBe(false);
  });
});

describe("upsertBatch", () => {
  it("returns the batch count on successful multi-row upserts", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 2 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    const result = await upsertBatch(
      supabase as never,
      "model_news",
      [{ source_id: "row-1" }, { source_id: "row-2" }],
      "source,source_id"
    );

    expect(result).toEqual({ created: 2, errors: [] });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("falls back to single-row upserts when a multi-row batch fails", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "invalid input syntax for type json" }, count: null })
      .mockResolvedValueOnce({ error: null, count: 1 })
      .mockResolvedValueOnce({ error: null, count: 1 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    const result = await upsertBatch(
      supabase as never,
      "model_news",
      [{ source_id: "row-1" }, { source_id: "row-2" }],
      "source,source_id"
    );

    expect(result).toEqual({ created: 2, errors: [] });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert).toHaveBeenNthCalledWith(2, [{ source_id: "row-1" }], {
      onConflict: "source,source_id",
      count: "exact",
    });
  });

  it("reports only the rows that still fail after fallback", async () => {
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: "invalid input syntax for type json" }, count: null })
      .mockResolvedValueOnce({ error: null, count: 1 })
      .mockResolvedValueOnce({ error: { message: "still bad" }, count: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    const result = await upsertBatch(
      supabase as never,
      "model_news",
      [{ source_id: "row-1" }, { source_id: "row-2" }],
      "source,source_id"
    );

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        message: "Upsert row failed after batch fallback: still bad",
        context: expect.stringContaining("row=row-2"),
      }),
    ]);
  });

  it("sanitizes JSON-invalid string content before upserting", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    await upsertBatch(
      supabase as never,
      "model_news",
      [{
        source_id: "row-1",
        summary: "bad\u0000text\ud800",
        metadata: {
          nested: "more\u0000bad\udfff",
          tags: ["ok", "tag\u0000\ud800"],
        },
      }],
      "source,source_id"
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        {
          source_id: "row-1",
          summary: "badtext\ufffd",
          metadata: {
            nested: "morebad\ufffd",
            tags: ["ok", "tag\ufffd"],
          },
        },
      ],
      {
        onConflict: "source,source_id",
        count: "exact",
      }
    );
  });

  it("canonicalizes provider aliases before upserting models and model news", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 2 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    await upsertBatch(
      supabase as never,
      "models",
      [
        {
          slug: "z-ai-glm-4-6-exacto",
          provider: "Z-ai",
        },
      ],
      "slug"
    );

    await upsertBatch(
      supabase as never,
      "model_news",
      [
        {
          source_id: "provider-deployment-signals-zai-devpack-overview",
          related_provider: "Z-ai",
        },
      ],
      "source,source_id"
    );

    expect(upsert).toHaveBeenNthCalledWith(
      1,
      [
        expect.objectContaining({
          slug: "z-ai-glm-4-6-exacto",
          provider: "Z.ai",
          overall_rank: null,
          quality_score: null,
          capability_score: null,
          popularity_score: null,
          hf_trending_score: null,
        }),
      ],
      {
        onConflict: "slug",
        count: "exact",
      }
    );

    expect(upsert).toHaveBeenNthCalledWith(
      2,
      [
        {
          source_id: "provider-deployment-signals-zai-devpack-overview",
          related_provider: "Z.ai",
        },
      ],
      {
        onConflict: "source,source_id",
        count: "exact",
      }
    );
  });

  it("strips ranking inputs from packaging and wrapper model rows before upserting", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 2 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    await upsertBatch(
      supabase as never,
      "models",
      [
        {
          slug: "community-cool-model-gguf",
          provider: "Community",
          name: "Cool Model GGUF",
          category: "llm",
          release_date: "2026-04-01",
          context_window: 32768,
          overall_rank: 12,
          quality_score: 88,
          capability_score: 86,
          popularity_score: 80,
          hf_trending_score: 99,
        },
        {
          slug: "community-cool-model-latest",
          provider: "Community",
          name: "Cool Model Latest",
          category: "llm",
          context_window: 32768,
          overall_rank: 9,
          quality_score: 90,
          capability_score: 89,
          popularity_score: 91,
          hf_trending_score: 87,
        },
      ],
      "slug"
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          slug: "community-cool-model-gguf",
          overall_rank: null,
          quality_score: null,
          capability_score: null,
          popularity_score: null,
          hf_downloads: null,
          hf_likes: null,
          hf_trending_score: null,
        }),
        expect.objectContaining({
          slug: "community-cool-model-latest",
          overall_rank: null,
          quality_score: null,
          capability_score: null,
          popularity_score: null,
          hf_downloads: null,
          hf_likes: null,
          hf_trending_score: null,
        }),
      ],
      {
        onConflict: "slug",
        count: "exact",
      }
    );
  });

  it("strips raw public signal inputs from low-trust community rows", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    await upsertBatch(
      supabase as never,
      "models",
      [
        {
          slug: "community-wrapper-row",
          provider: "Community Hub",
          name: "Community Wrapper Row",
          category: "llm",
          release_date: "2026-04-01",
          context_window: 32768,
          hf_downloads: 1200,
          hf_likes: 40,
          hf_trending_score: 9,
        },
      ],
      "slug"
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          slug: "community-wrapper-row",
          hf_downloads: null,
          hf_likes: null,
          hf_trending_score: null,
        }),
      ],
      {
        onConflict: "slug",
        count: "exact",
      }
    );
  });

  it("preserves ranking inputs for discovery-ready official model rows", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null, count: 1 });
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    await upsertBatch(
      supabase as never,
      "models",
      [
        {
          slug: "google-gemma-4-31b-it",
          provider: "Google",
          name: "Gemma 4 31B IT",
          category: "multimodal",
          release_date: "2026-04-02",
          context_window: 131072,
          is_open_weights: true,
          license: "open_source",
          license_name: "Apache 2.0",
          overall_rank: 7,
          quality_score: 92,
          capability_score: 90,
          popularity_score: 78,
          hf_trending_score: 44,
        },
      ],
      "slug"
    );

    expect(upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          slug: "google-gemma-4-31b-it",
          overall_rank: 7,
          quality_score: 92,
          capability_score: 90,
          popularity_score: 78,
          hf_trending_score: 44,
        }),
      ],
      {
        onConflict: "slug",
        count: "exact",
      }
    );
  });
});
