/**
 * Shared category and modality inference functions.
 *
 * Unifies all 5 inferCategory() implementations from:
 *   - openai-models.ts  (id mode)
 *   - google-models.ts  (id mode)
 *   - replicate.ts      (description mode)
 *   - openrouter-models.ts (arch mode)
 *   - github-trending.ts   (topics mode)
 *
 * And both inferModalities() implementations from openai + google.
 *
 * IMPORTANT: This module does NOT import from build-record.ts — it accepts
 * only primitives to avoid circular dependencies (Pitfall 5 in RESEARCH.md).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InferCategoryMode = "id" | "description" | "arch" | "topics";

export interface InferCategoryOptions {
  mode: InferCategoryMode;
  /** Used by "id" mode: the model ID string. */
  modelId?: string;
  /** Used by "description" mode: the description text (may be null). */
  description?: string | null;
  /** Used by "arch" mode: OpenRouter architecture object with modality arrays. */
  arch?: {
    input_modalities?: string[];
    output_modalities?: string[];
    modality?: string;
  };
  /** Used by "topics" mode: GitHub topics array. */
  topics?: string[];
}

// ---------------------------------------------------------------------------
// Internal keyword maps
// ---------------------------------------------------------------------------

/**
 * ID-based prefix → category mappings.
 * Merges OpenAI and Google prefix rules; order matters (more specific first).
 */
const ID_PREFIX_CATEGORY: Array<[string, string]> = [
  // OpenAI o-series reasoning models
  ["o1", "llm"],
  ["o3", "llm"],
  ["o4", "llm"],
  // OpenAI image generation (gpt-image MUST appear before gpt- so prefix matching is correct)
  ["gpt-image", "image_generation"],
  ["dall-e", "image_generation"],
  // OpenAI GPT (broad match — comes after more-specific gpt-image)
  ["gpt-", "llm"],
  // OpenAI speech / audio
  ["whisper", "speech_audio"],
  ["tts-", "speech_audio"],
  // OpenAI embeddings
  ["text-embedding", "embeddings"],
  // OpenAI code
  ["codex", "code"],
  // Google Gemini multimodal
  ["gemini", "multimodal"],
  // Google Gemma open-weights LLM
  ["gemma", "llm"],
  // Google image generation
  ["imagen", "image_generation"],
  // Google video generation
  ["veo", "video"],
  // Google embeddings
  ["embedding", "embeddings"],
];

/**
 * Description-based keyword → category mappings (Replicate strategy).
 * Each entry is [keyword_array, category]. Order matters — more specific first.
 */
const DESC_KEYWORD_CATEGORY: Array<[string[], string]> = [
  // Video (check before image to avoid confusion with "video generation" images)
  [["text-to-video", "video generation", "video synthesis", "animate"], "video"],
  // Image generation
  [
    [
      "text-to-image",
      "image generation",
      "stable diffusion",
      "diffusion model",
      "generate image",
      "img2img",
      "image-to-image",
      "inpainting",
    ],
    "image_generation",
  ],
  // Vision / image processing
  [
    [
      "object detection",
      "image classification",
      "image segmentation",
      "image recognition",
      "visual",
    ],
    "vision",
  ],
  // Speech / audio
  [
    [
      "text-to-speech",
      "speech-to-text",
      "speech recognition",
      "audio generation",
      "music generation",
      "voice clone",
      "tts",
      "asr",
    ],
    "speech_audio",
  ],
  // Embeddings
  [["embedding", "sentence similarity", "vector"], "embeddings"],
  // Multimodal
  [["multimodal", "vision language", "image and text"], "multimodal"],
  // Code
  [["code generation", "code completion", "programming"], "code"],
  // LLM (broad match last)
  [
    [
      "language model",
      "llm",
      "text generation",
      "chat",
      "conversational",
      "instruction",
      "gpt",
      "llama",
      "mistral",
    ],
    "llm",
  ],
];

/**
 * Topics/description combined keyword → category mappings (GitHub strategy).
 * Order matters — more specific checks first.
 */
const TOPICS_KEYWORD_CATEGORY: Array<[string[], string]> = [
  [["llm", "language-model", "language model", "chatbot", "chat"], "llm"],
  [["diffusion", "image-generation", "text-to-image"], "image_generation"],
  [["vision", "object-detection", "image-classification"], "vision"],
  [["multimodal", "vlm"], "multimodal"],
  [["embedding", "sentence-transformer"], "embeddings"],
  [["speech", "tts", "asr", "audio"], "speech_audio"],
  [["video"], "video"],
  [["code", "coding"], "code"],
];

// ---------------------------------------------------------------------------
// inferCategory — unified function with mode dispatch
// ---------------------------------------------------------------------------

/**
 * Infer the model category based on the provided mode and input data.
 *
 * @param opts - Options object; `mode` is required to select the inference strategy.
 * @returns A category string (e.g. "llm", "multimodal", "image_generation").
 */
export function inferCategory(opts: InferCategoryOptions): string {
  switch (opts.mode) {
    case "id": {
      const id = (opts.modelId ?? "").toLowerCase();
      for (const [prefix, category] of ID_PREFIX_CATEGORY) {
        if (id.startsWith(prefix) || (prefix.includes(".") && id.includes(prefix))) {
          return category;
        }
      }
      return "specialized";
    }

    case "description": {
      const desc = (opts.description ?? "").toLowerCase();
      if (!desc) return "specialized";
      for (const [keywords, category] of DESC_KEYWORD_CATEGORY) {
        if (keywords.some((kw) => desc.includes(kw))) return category;
      }
      return "specialized";
    }

    case "arch": {
      const outputs = new Set(opts.arch?.output_modalities ?? []);
      const inputs = new Set(opts.arch?.input_modalities ?? []);
      if (outputs.has("image")) return "image_generation";
      if (outputs.has("video")) return "video";
      if (outputs.has("audio")) return "speech_audio";
      if (
        (inputs.has("image") || inputs.has("video") || inputs.has("audio")) &&
        outputs.has("text")
      ) {
        return "multimodal";
      }
      return "llm";
    }

    case "topics": {
      const text = `${(opts.topics ?? []).join(" ")} ${opts.description ?? ""}`.toLowerCase();
      for (const [keywords, category] of TOPICS_KEYWORD_CATEGORY) {
        if (keywords.some((kw) => text.includes(kw))) return category;
      }
      return "specialized";
    }
  }
}

// ---------------------------------------------------------------------------
// inferModalities — merged OpenAI + Google implementations
// ---------------------------------------------------------------------------

/**
 * Infer the model modalities from the model ID.
 * Merges OpenAI and Google prefix-based implementations.
 * Returns an array of modality strings; defaults to ["text"].
 *
 * @param modelId - The model ID string (e.g. "dall-e-3", "whisper-1").
 */
export function inferModalities(modelId: string): string[] {
  const id = modelId.toLowerCase();

  // Image generation models
  if (id.startsWith("dall-e") || id.includes("image") || id.startsWith("imagen")) {
    return ["text", "image"];
  }

  // Speech recognition (audio input → text output)
  if (id.startsWith("whisper")) return ["audio", "text"];

  // Text-to-speech (text input → audio output)
  if (id.startsWith("tts-")) return ["text", "audio"];

  // Embeddings
  if (id.startsWith("text-embedding") || id.includes("embedding")) return ["text"];

  // GPT-4o family has audio capabilities
  if (id.startsWith("gpt-4o")) return ["text", "image", "audio"];

  // Google Gemini — multimodal with video
  if (id.startsWith("gemini")) return ["text", "image", "audio", "video"];

  // Google Gemma — text only
  if (id.startsWith("gemma")) return ["text"];

  // Google Imagen
  if (id.startsWith("imagen")) return ["text", "image"];

  // Google Veo — video generation
  if (id.startsWith("veo")) return ["text", "image", "video"];

  return ["text"];
}
