import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import adapter, { __testables } from "./google-models";

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
      "https://ai.google.dev/gemini-api/docs/models"
    );
  });

  it("extracts current model and specialist IDs without documentation assets", () => {
    const html = `
      <code>gemini-3.6-flash</code>
      <code>gemini-3.5-live-translate-preview</code>
      <code>gemini-embedding-2</code>
      <code>gemini-robotics-er-2-preview</code>
      <code>gemini-robotics-er-2-streaming-preview</code>
      <code>lyria-3-pro-preview</code>
      <code>veo-3.1-lite-generate-preview</code>
      <script src="/assets/gemini-api-v2.css"></script>
      <a href="/gemini-api/docs/models">gemini-api-docs</a>
    `;

    expect(__testables.extractGoogleModelIds(html)).toEqual([
      "gemini-3.6-flash",
      "gemini-3.5-live-translate-preview",
      "gemini-embedding-2",
      "gemini-robotics-er-2-preview",
      "gemini-robotics-er-2-streaming-preview",
      "lyria-3-pro-preview",
      "veo-3.1-lite-generate-preview",
    ]);
  });
});
