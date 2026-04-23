import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import adapter from "./artificial-analysis";

describe("artificial-analysis adapter", () => {
  beforeEach(() => {
    vi.stubEnv("ARTIFICIAL_ANALYSIS_API_KEY", "test-aa-key");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports the API as reachable when the health check succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.healthCheck({});

    expect(result.healthy).toBe(true);
    expect(result.message).toBe("v2 API reachable");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://artificialanalysis.ai/api/v2/data/llms/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json",
          "x-api-key": "test-aa-key",
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("times out quickly to the static fallback when the API stalls", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      })
    );

    const healthCheckPromise = adapter.healthCheck({});
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await healthCheckPromise;

    expect(result.healthy).toBe(true);
    expect(result.message).toBe(
      "v2 API health check timed out — static fallback available"
    );
  });
});
