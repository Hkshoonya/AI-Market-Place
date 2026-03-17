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
});
