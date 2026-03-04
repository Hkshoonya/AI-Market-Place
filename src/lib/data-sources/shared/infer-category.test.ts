/**
 * Unit tests for shared inferCategory() and inferModalities() functions.
 * Covers all 4 modes: id, description, arch, topics.
 */

import { describe, it, expect } from "vitest";
import { inferCategory, inferModalities } from "./infer-category";

// ---------------------------------------------------------------------------
// inferCategory — "id" mode
// ---------------------------------------------------------------------------

describe('inferCategory — "id" mode', () => {
  it('returns "llm" for "gpt-4o"', () => {
    expect(inferCategory({ mode: "id", modelId: "gpt-4o" })).toBe("llm");
  });

  it('returns "image_generation" for "dall-e-3"', () => {
    expect(inferCategory({ mode: "id", modelId: "dall-e-3" })).toBe("image_generation");
  });

  it('returns "speech_audio" for "whisper-1"', () => {
    expect(inferCategory({ mode: "id", modelId: "whisper-1" })).toBe("speech_audio");
  });

  it('returns "speech_audio" for "tts-1"', () => {
    expect(inferCategory({ mode: "id", modelId: "tts-1" })).toBe("speech_audio");
  });

  it('returns "embeddings" for "text-embedding-3-large"', () => {
    expect(inferCategory({ mode: "id", modelId: "text-embedding-3-large" })).toBe("embeddings");
  });

  it('returns "multimodal" for "gemini-2.0-flash"', () => {
    expect(inferCategory({ mode: "id", modelId: "gemini-2.0-flash" })).toBe("multimodal");
  });

  it('returns "llm" for "gemma-2b"', () => {
    expect(inferCategory({ mode: "id", modelId: "gemma-2b" })).toBe("llm");
  });

  it('returns "image_generation" for "imagen-3"', () => {
    expect(inferCategory({ mode: "id", modelId: "imagen-3" })).toBe("image_generation");
  });

  it('returns "specialized" for unknown model "unknown-model"', () => {
    expect(inferCategory({ mode: "id", modelId: "unknown-model" })).toBe("specialized");
  });

  it('returns "llm" for "o3" (reasoning model)', () => {
    expect(inferCategory({ mode: "id", modelId: "o3" })).toBe("llm");
  });

  it('returns "llm" for "o1-mini"', () => {
    expect(inferCategory({ mode: "id", modelId: "o1-mini" })).toBe("llm");
  });

  it('returns "code" for "codex-mini-latest"', () => {
    expect(inferCategory({ mode: "id", modelId: "codex-mini-latest" })).toBe("code");
  });

  it('returns "video" for "veo-2"', () => {
    expect(inferCategory({ mode: "id", modelId: "veo-2" })).toBe("video");
  });

  it('returns "image_generation" for "gpt-image-1"', () => {
    expect(inferCategory({ mode: "id", modelId: "gpt-image-1" })).toBe("image_generation");
  });

  it('handles empty modelId by returning "specialized"', () => {
    expect(inferCategory({ mode: "id", modelId: "" })).toBe("specialized");
  });

  it('handles missing modelId by returning "specialized"', () => {
    expect(inferCategory({ mode: "id" })).toBe("specialized");
  });
});

// ---------------------------------------------------------------------------
// inferCategory — "description" mode
// ---------------------------------------------------------------------------

describe('inferCategory — "description" mode', () => {
  it('returns "image_generation" for text-to-image description', () => {
    expect(
      inferCategory({ mode: "description", description: "text-to-image generation model" })
    ).toBe("image_generation");
  });

  it('returns "image_generation" for stable diffusion description', () => {
    expect(
      inferCategory({ mode: "description", description: "stable diffusion model for art generation" })
    ).toBe("image_generation");
  });

  it('returns "video" for text-to-video description (checked before image)', () => {
    expect(
      inferCategory({ mode: "description", description: "text-to-video generation for short clips" })
    ).toBe("video");
  });

  it('returns "speech_audio" for music generation description', () => {
    expect(
      inferCategory({ mode: "description", description: "music generation model for creating original tracks" })
    ).toBe("speech_audio");
  });

  it('returns "llm" for language model description', () => {
    expect(
      inferCategory({ mode: "description", description: "large language model for text generation and chat" })
    ).toBe("llm");
  });

  it('returns "embeddings" for embedding description', () => {
    expect(
      inferCategory({ mode: "description", description: "text embedding model for semantic search" })
    ).toBe("embeddings");
  });

  it('returns "specialized" for null description', () => {
    expect(inferCategory({ mode: "description", description: null })).toBe("specialized");
  });

  it('returns "specialized" for empty description', () => {
    expect(inferCategory({ mode: "description", description: "" })).toBe("specialized");
  });

  it('returns "specialized" for unrecognized description', () => {
    expect(
      inferCategory({ mode: "description", description: "a completely unknown model type" })
    ).toBe("specialized");
  });

  it('returns "vision" for image classification description', () => {
    expect(
      inferCategory({ mode: "description", description: "image classification using deep learning" })
    ).toBe("vision");
  });

  it('returns "multimodal" for vision language model description', () => {
    expect(
      inferCategory({ mode: "description", description: "vision language model for image and text understanding" })
    ).toBe("multimodal");
  });
});

// ---------------------------------------------------------------------------
// inferCategory — "arch" mode
// ---------------------------------------------------------------------------

describe('inferCategory — "arch" mode', () => {
  it('returns "image_generation" for arch with image output', () => {
    expect(
      inferCategory({ mode: "arch", arch: { output_modalities: ["image"] } })
    ).toBe("image_generation");
  });

  it('returns "video" for arch with video output', () => {
    expect(
      inferCategory({ mode: "arch", arch: { output_modalities: ["video"] } })
    ).toBe("video");
  });

  it('returns "speech_audio" for arch with audio output', () => {
    expect(
      inferCategory({ mode: "arch", arch: { output_modalities: ["audio"] } })
    ).toBe("speech_audio");
  });

  it('returns "multimodal" for arch with image input and text output', () => {
    expect(
      inferCategory({
        mode: "arch",
        arch: { input_modalities: ["image", "text"], output_modalities: ["text"] },
      })
    ).toBe("multimodal");
  });

  it('returns "multimodal" for arch with audio input and text output', () => {
    expect(
      inferCategory({
        mode: "arch",
        arch: { input_modalities: ["audio"], output_modalities: ["text"] },
      })
    ).toBe("multimodal");
  });

  it('returns "llm" for arch with text-only output', () => {
    expect(
      inferCategory({ mode: "arch", arch: { output_modalities: ["text"] } })
    ).toBe("llm");
  });

  it('returns "llm" for empty arch object', () => {
    expect(inferCategory({ mode: "arch", arch: {} })).toBe("llm");
  });

  it('returns "llm" when no arch provided', () => {
    expect(inferCategory({ mode: "arch" })).toBe("llm");
  });

  it('image output takes priority over multimodal inputs', () => {
    expect(
      inferCategory({
        mode: "arch",
        arch: {
          input_modalities: ["text", "image"],
          output_modalities: ["image", "text"],
        },
      })
    ).toBe("image_generation");
  });
});

// ---------------------------------------------------------------------------
// inferCategory — "topics" mode
// ---------------------------------------------------------------------------

describe('inferCategory — "topics" mode', () => {
  it('returns "image_generation" for image-generation topic', () => {
    expect(
      inferCategory({ mode: "topics", topics: ["image-generation"], description: "" })
    ).toBe("image_generation");
  });

  it('returns "llm" for llm topic', () => {
    expect(
      inferCategory({ mode: "topics", topics: ["llm"], description: "" })
    ).toBe("llm");
  });

  it('returns "vision" for computer-vision topic with image classifier description', () => {
    expect(
      inferCategory({
        mode: "topics",
        topics: ["computer-vision"],
        description: "image classifier model",
      })
    ).toBe("vision");
  });

  it('returns "speech_audio" for tts topic', () => {
    expect(
      inferCategory({ mode: "topics", topics: ["tts"], description: "" })
    ).toBe("speech_audio");
  });

  it('returns "specialized" for empty topics and empty description', () => {
    expect(inferCategory({ mode: "topics", topics: [], description: "" })).toBe("specialized");
  });

  it('returns "specialized" for unrecognized topics', () => {
    expect(
      inferCategory({ mode: "topics", topics: ["web-scraping", "database"], description: "" })
    ).toBe("specialized");
  });

  it('falls back to description text if topics do not match', () => {
    // "diffusion" matches image-generation via description keywords (via topics mode scanning both)
    expect(
      inferCategory({
        mode: "topics",
        topics: ["machine-learning"],
        description: "diffusion model for text-to-image synthesis",
      })
    ).toBe("image_generation");
  });

  it('handles missing topics gracefully', () => {
    expect(inferCategory({ mode: "topics", description: "language model for chat" })).toBe("llm");
  });
});

// ---------------------------------------------------------------------------
// inferModalities
// ---------------------------------------------------------------------------

describe("inferModalities", () => {
  it('returns array containing "text" for "gpt-4o"', () => {
    const modalities = inferModalities("gpt-4o");
    expect(modalities).toContain("text");
  });

  it('returns ["text","image","audio"] for "gpt-4o"', () => {
    expect(inferModalities("gpt-4o")).toEqual(["text", "image", "audio"]);
  });

  it('returns array containing "image" for "dall-e-3"', () => {
    const modalities = inferModalities("dall-e-3");
    expect(modalities).toContain("image");
  });

  it('returns array containing "audio" for "whisper-1"', () => {
    const modalities = inferModalities("whisper-1");
    expect(modalities).toContain("audio");
  });

  it('returns ["text"] for unknown model', () => {
    expect(inferModalities("unknown-model")).toEqual(["text"]);
  });

  it('returns ["text","audio"] for "tts-1"', () => {
    expect(inferModalities("tts-1")).toEqual(["text", "audio"]);
  });

  it('returns ["text"] for "text-embedding-3-large"', () => {
    expect(inferModalities("text-embedding-3-large")).toEqual(["text"]);
  });

  it('returns multimodal array for gemini model', () => {
    const modalities = inferModalities("gemini-2.0-flash");
    expect(modalities).toContain("text");
    expect(modalities).toContain("image");
    expect(modalities).toContain("video");
  });

  it('returns ["text"] for gemma model', () => {
    expect(inferModalities("gemma-2")).toEqual(["text"]);
  });

  it('returns ["text","image","video"] for veo model', () => {
    expect(inferModalities("veo-2")).toEqual(["text", "image", "video"]);
  });

  it('returns ["audio","text"] for whisper', () => {
    expect(inferModalities("whisper-1")).toEqual(["audio", "text"]);
  });
});
