import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  getIndexNowKeyLocation,
  normalizeIndexNowUrls,
  submitIndexNowUrls,
} from "./indexnow";

describe("indexnow utilities", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("INDEXNOW_KEY", "indexnow-test-key");
    global.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 })
    ) as typeof fetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
  });

  it("normalizes urls to the canonical host and removes duplicates", () => {
    expect(
      normalizeIndexNowUrls([
        "https://aimarketcap.tech/models/test#section",
        "https://aimarketcap.tech/models/test",
        "https://example.com/models/test",
        "notaurl",
      ])
    ).toEqual(["https://aimarketcap.tech/models/test"]);
  });

  it("submits deduplicated urls in IndexNow payloads", async () => {
    const result = await submitIndexNowUrls([
      "https://aimarketcap.tech/models/model-a",
      "https://aimarketcap.tech/models/model-a",
      "https://aimarketcap.tech/providers/openai",
    ]);

    expect(result).toMatchObject({
      endpoint: INDEXNOW_ENDPOINT,
      submittedUrlCount: 2,
      batchCount: 1,
      keyLocation: getIndexNowKeyLocation(),
    });
    expect(fetch).toHaveBeenCalledWith(
      INDEXNOW_ENDPOINT,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "aimarketcap.tech",
          key: "indexnow-test-key",
          keyLocation: getIndexNowKeyLocation(),
          urlList: [
            "https://aimarketcap.tech/models/model-a",
            "https://aimarketcap.tech/providers/openai",
          ],
        }),
      })
    );
  });

  it("submits multiple batches when the url list exceeds the per-request limit", async () => {
    const urls = Array.from({ length: INDEXNOW_MAX_URLS_PER_REQUEST + 2 }, (_, index) =>
      `https://aimarketcap.tech/models/model-${index}`
    );

    const result = await submitIndexNowUrls(urls);

    expect(result.batchCount).toBe(2);
    expect(result.submittedUrlCount).toBe(INDEXNOW_MAX_URLS_PER_REQUEST + 2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
