/**
 * Unit tests for data-sources/utils.ts
 *
 * Covers:
 * 1. resolveSecrets() - returns { secrets, missing } structured result
 * 2. fetchWithRetry() - retry behavior on 5xx and 429
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { resolveSecrets, fetchWithRetry } from "./utils";

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
