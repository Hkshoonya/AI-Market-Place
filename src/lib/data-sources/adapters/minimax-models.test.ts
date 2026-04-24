import { describe, expect, it, vi } from "vitest";

import { __testables } from "./minimax-models";

describe("minimax-models adapter", () => {
  it("extracts model ids from the official docs page", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<html>MiniMax-M2.7 MiniMax-M1 MiniMax-M1-80k MiniMax-AI</html>",
        { status: 200 }
      )
    );

    await expect(__testables.scrapeModelIds()).resolves.toEqual([
      "MiniMax-M1",
      "MiniMax-M1-80k",
      "MiniMax-M2.7",
    ]);

    fetchMock.mockRestore();
  });

  it("builds canonical provider records for MiniMax models", () => {
    const record = __testables.buildModelRecord("MiniMax-M2.7");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        slug: "minimax-minimax-m2-7",
        name: "MiniMax M2.7",
        website_url: "https://www.minimax.io/models/text",
      })
    );
  });

  it("marks officially open-weight MiniMax models as open source", () => {
    const record = __testables.buildModelRecord("MiniMax-M2.5");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        is_open_weights: true,
        license: "open_source",
        license_name: "Open weights",
      })
    );
  });

  it("applies family fallback metadata to MiniMax variant releases", () => {
    const record = __testables.buildModelRecord("MiniMax-M2.5-highspeed");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        is_open_weights: true,
        license: "open_source",
        license_name: "Open weights",
      })
    );
  });

  it("applies family fallback metadata to MiniMax M2.1 variant releases", () => {
    const record = __testables.buildModelRecord("MiniMax-M2.1-highspeed");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        category: "llm",
        modalities: ["text"],
        is_open_weights: false,
        license: "commercial",
        license_name: null,
      })
    );
  });

  it("keeps MiniMax speech models proprietary with audio metadata", () => {
    const record = __testables.buildModelRecord("speech-2.8-turbo");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        category: "speech_audio",
        modalities: ["text", "audio"],
        is_open_weights: false,
        license: "commercial",
        license_name: null,
      })
    );
  });

  it("carries official release dates for MiniMax Speech 2.6 variants", () => {
    const turbo = __testables.buildModelRecord("speech-2.6-turbo");
    const hd = __testables.buildModelRecord("speech-2.6-hd");

    expect(turbo).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        release_date: "2025-10-30",
      })
    );
    expect(hd).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        release_date: "2025-10-30",
      })
    );
  });

  it("keeps MiniMax music models proprietary with audio metadata", () => {
    const record = __testables.buildModelRecord("music-2.5");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        category: "speech_audio",
        modalities: ["text", "audio"],
        is_open_weights: false,
        license: "commercial",
        license_name: null,
      })
    );
  });

  it("adds official website metadata to MiniMax M2-her", () => {
    const record = __testables.buildModelRecord("MiniMax-M2-her");

    expect(record).toEqual(
      expect.objectContaining({
        provider: "MiniMax",
        slug: "minimax-minimax-m2-her",
        website_url: "https://www.minimax.io/models/text",
      })
    );
  });
});
