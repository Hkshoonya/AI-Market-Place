import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import adapter from "./google-models";

describe("google-models adapter", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_AI_API_KEY", "test-google-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("treats the source as healthy when API access fails but docs fallback is reachable", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad request", { status: 400 }))
      .mockResolvedValueOnce(new Response("<html>docs ok</html>", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await adapter.healthCheck({});

    expect(result).toEqual(
      expect.objectContaining({
        healthy: true,
        message: "API returned HTTP 400 — docs/static fallback available",
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://ai.google.dev/gemini-api/docs/models/gemini"
    );
  });
});
