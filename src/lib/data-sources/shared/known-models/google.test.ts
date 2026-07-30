import { describe, expect, it } from "vitest";

import { resolveGoogleKnownModelMeta } from "./google";

describe("resolveGoogleKnownModelMeta", () => {
  it("returns current stable Gemini 3.5 and 3.6 metadata", () => {
    expect(resolveGoogleKnownModelMeta("gemini-3.6-flash")).toMatchObject({
      name: "Gemini 3.6 Flash",
      release_date: "2026-07-21",
      status: "active",
      context_window: 1048576,
    });
    expect(resolveGoogleKnownModelMeta("gemini-3.5-flash")).toMatchObject({
      name: "Gemini 3.5 Flash",
      release_date: "2026-05-19",
      status: "active",
    });
    expect(resolveGoogleKnownModelMeta("gemini-3.5-flash-lite")).toMatchObject({
      name: "Gemini 3.5 Flash-Lite",
      release_date: "2026-07-21",
      status: "active",
    });
    expect(resolveGoogleKnownModelMeta("gemini-flash-latest")?.name).toBe(
      "Gemini 3.6 Flash"
    );
  });

  it("returns exact Gemini 3.1 lifecycle metadata", () => {
    expect(resolveGoogleKnownModelMeta("gemini-3.1-pro-preview")).toMatchObject({
      name: "Gemini 3.1 Pro Preview",
      release_date: "2026-02-19",
      status: "preview",
      website_url:
        "https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview",
    });

    expect(resolveGoogleKnownModelMeta("gemini-3.1-flash-lite")).toMatchObject({
      name: "Gemini 3.1 Flash Lite",
      release_date: "2026-05-07",
    });

    expect(
      resolveGoogleKnownModelMeta("gemini-3.1-flash-live-preview")
    ).toMatchObject({
      name: "Gemini 3.1 Flash Live Preview",
      release_date: "2026-03-11",
      status: "preview",
    });

    expect(resolveGoogleKnownModelMeta("gemini-3.1-flash-image")).toMatchObject({
      name: "Gemini 3.1 Flash Image",
      release_date: "2026-05-28",
      status: "active",
    });
  });

  it("tracks current Google specialist model endpoints", () => {
    expect(
      resolveGoogleKnownModelMeta("gemini-3.5-live-translate-preview")
    ).toMatchObject({
      category: "speech_audio",
      context_window: 131072,
      status: "preview",
    });
    expect(resolveGoogleKnownModelMeta("gemini-embedding-2")).toMatchObject({
      category: "embeddings",
      context_window: 8192,
      release_date: "2026-04-22",
      status: "active",
    });
    expect(
      resolveGoogleKnownModelMeta("gemini-robotics-er-2-preview")
    ).toMatchObject({
      category: "specialized",
      context_window: 131072,
      status: "preview",
    });
    expect(
      resolveGoogleKnownModelMeta("gemini-robotics-er-2-streaming-preview")
    ).toMatchObject({
      category: "specialized",
      status: "preview",
    });
    expect(resolveGoogleKnownModelMeta("gemini-omni-flash-preview")).toMatchObject({
      category: "video",
      status: "preview",
    });
  });

  it("marks stable Gemini 2.5 rows as deprecated in favor of newer Gemini 3 releases", () => {
    expect(resolveGoogleKnownModelMeta("gemini-2.5-pro")).toMatchObject({
      name: "Gemini 2.5 Pro",
      status: "deprecated",
    });

    expect(resolveGoogleKnownModelMeta("gemini-2.5-flash")).toMatchObject({
      name: "Gemini 2.5 Flash",
      status: "deprecated",
    });

    expect(resolveGoogleKnownModelMeta("gemini-2.5-flash-lite")).toMatchObject({
      name: "Gemini 2.5 Flash Lite",
      status: "deprecated",
    });
  });

  it("returns exact Gemma 4 variant metadata when present", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-4-31b-it");

    expect(meta).toMatchObject({
      name: "Gemma 4 31B IT",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2026-04-02",
      category: "multimodal",
    });
  });

  it("falls back to the Gemma 4 family metadata for unknown Gemma 4 variants", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-4-custom-preview");

    expect(meta).toMatchObject({
      name: "Gemma 4",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2026-04-02",
      category: "multimodal",
    });
  });

  it("falls back to the Gemma 3n family metadata for Gemma 3n variants", () => {
    const meta = resolveGoogleKnownModelMeta("gemma-3n-e4b-it");

    expect(meta).toMatchObject({
      name: "Gemma 3n",
      is_open_weights: true,
      license: "open_source",
      license_name: "Apache 2.0",
      release_date: "2025-05-20",
      category: "multimodal",
      modalities: ["text", "image", "audio"],
    });
  });

  it("resolves exact Google aliases for packaging and pro commercial variants", () => {
    expect(resolveGoogleKnownModelMeta("gemma-3n-e4b-it-litert-lm")).toMatchObject({
      name: "gemma-3n-E4B-it-litert-lm",
      context_window: 32000,
      license: "open_source",
      license_name: "Apache 2.0",
    });

    expect(resolveGoogleKnownModelMeta("lyria-3-pro-preview")).toMatchObject({
      name: "Lyria 3 Pro Preview",
      category: "speech_audio",
      license: "commercial",
      is_open_weights: false,
      status: "preview",
    });
  });

  it("resolves Google API wrapper IDs to canonical release metadata", () => {
    expect(resolveGoogleKnownModelMeta("imagen-4.0-generate-001")).toMatchObject({
      name: "Imagen 4",
      release_date: "2025-06-24",
      category: "image_generation",
      status: "deprecated",
    });

    expect(resolveGoogleKnownModelMeta("veo-2.0-generate-001")).toMatchObject({
      name: "Veo 2",
      release_date: "2025-04-09",
      category: "video",
      status: "archived",
    });
  });

  it("resolves Google canonical metadata for embeddings and live-audio aliases", () => {
    expect(resolveGoogleKnownModelMeta("gemini-embedding-001")).toMatchObject({
      name: "Gemini Embedding 001",
      release_date: "2025-07-14",
      category: "embeddings",
      context_window: 2048,
    });

    expect(resolveGoogleKnownModelMeta("aqa")).toMatchObject({
      name: "Attributed Question Answering (AQA)",
      release_date: "2023-12-13",
      category: "specialized",
      context_window: 7168,
    });

    expect(resolveGoogleKnownModelMeta("gemini-2.5-flash-image")).toMatchObject({
      name: "Gemini 2.5 Flash Image",
      release_date: "2025-10-02",
      category: "multimodal",
      context_window: 65536,
    });

    expect(
      resolveGoogleKnownModelMeta("gemini-2.5-flash-native-audio-latest")
    ).toMatchObject({
      name: "Gemini 2.5 Flash Native Audio",
      release_date: "2025-09-23",
      category: "multimodal",
      context_window: 131072,
    });
  });
});
