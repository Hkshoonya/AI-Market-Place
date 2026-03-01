/**
 * Replicate Adapter
 *
 * Fetches models from the Replicate API using cursor-based pagination,
 * infers categories from descriptions, and upserts into Supabase.
 *
 * When REPLICATE_API_TOKEN is not provided, falls back to KNOWN_MODELS
 * static list so the adapter always produces useful data.
 */

import type {
  DataSourceAdapter,
  SyncContext,
  SyncResult,
  SyncError,
  HealthCheckResult,
} from "../types";
import { registerAdapter } from "../registry";
import {
  fetchWithRetry,
  createRateLimitedFetch,
  upsertBatch,
  makeSlug,
} from "../utils";

// ────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// ────────────────────────────────────────────────────────────────
// Static fallback — top popular Replicate models
// ────────────────────────────────────────────────────────────────

interface KnownModel {
  owner: string;
  name: string;
  description: string;
  category: string;
  run_count: number;
  is_open_weights: boolean;
}

const KNOWN_MODELS: KnownModel[] = [
  // Image generation — FLUX family
  {
    owner: "black-forest-labs",
    name: "flux-1.1-pro",
    description: "FLUX 1.1 Pro: state-of-the-art text-to-image model with superior image quality and prompt adherence",
    category: "image_generation",
    run_count: 50_000_000,
    is_open_weights: true,
  },
  {
    owner: "black-forest-labs",
    name: "flux-schnell",
    description: "FLUX Schnell: fast text-to-image generation model optimized for speed and quality",
    category: "image_generation",
    run_count: 80_000_000,
    is_open_weights: true,
  },
  {
    owner: "black-forest-labs",
    name: "flux-dev",
    description: "FLUX Dev: high-quality text-to-image diffusion model for developers",
    category: "image_generation",
    run_count: 60_000_000,
    is_open_weights: true,
  },
  {
    owner: "black-forest-labs",
    name: "flux-pro",
    description: "FLUX Pro: professional text-to-image generation with exceptional detail and realism",
    category: "image_generation",
    run_count: 30_000_000,
    is_open_weights: false,
  },
  // Image generation — Stability AI
  {
    owner: "stability-ai",
    name: "stable-diffusion-3.5-large",
    description: "Stable Diffusion 3.5 Large: latest Stability AI text-to-image model with improved quality and composition",
    category: "image_generation",
    run_count: 20_000_000,
    is_open_weights: true,
  },
  {
    owner: "stability-ai",
    name: "sdxl",
    description: "Stable Diffusion XL: high-resolution text-to-image generation model",
    category: "image_generation",
    run_count: 100_000_000,
    is_open_weights: true,
  },
  {
    owner: "stability-ai",
    name: "stable-diffusion",
    description: "Stable Diffusion: foundational open-source text-to-image diffusion model",
    category: "image_generation",
    run_count: 200_000_000,
    is_open_weights: true,
  },
  // Video generation
  {
    owner: "stability-ai",
    name: "stable-video-diffusion",
    description: "Stable Video Diffusion: image-to-video generation model for short video synthesis",
    category: "video",
    run_count: 5_000_000,
    is_open_weights: true,
  },
  {
    owner: "anotherjesse",
    name: "zeroscope-v2-xl",
    description: "Zeroscope V2 XL: text-to-video generation model for high-quality video synthesis",
    category: "video",
    run_count: 3_000_000,
    is_open_weights: true,
  },
  // LLMs — Meta Llama
  {
    owner: "meta",
    name: "llama-3.3-70b-instruct",
    description: "Llama 3.3 70B Instruct: Meta's latest large language model optimized for instruction following",
    category: "llm",
    run_count: 25_000_000,
    is_open_weights: true,
  },
  {
    owner: "meta",
    name: "llama-3.1-405b-instruct",
    description: "Llama 3.1 405B Instruct: Meta's largest open-weights language model for complex reasoning tasks",
    category: "llm",
    run_count: 15_000_000,
    is_open_weights: true,
  },
  {
    owner: "meta",
    name: "llama-3-70b-instruct",
    description: "Llama 3 70B Instruct: Meta's powerful open-source chat and instruction model",
    category: "llm",
    run_count: 40_000_000,
    is_open_weights: true,
  },
  {
    owner: "meta",
    name: "llama-2-70b-chat",
    description: "Llama 2 70B Chat: Meta's second-generation large language model optimized for dialogue",
    category: "llm",
    run_count: 60_000_000,
    is_open_weights: true,
  },
  // LLMs — Mistral
  {
    owner: "mistralai",
    name: "mistral-7b-instruct-v0.2",
    description: "Mistral 7B Instruct v0.2: fast and efficient instruction-following language model",
    category: "llm",
    run_count: 35_000_000,
    is_open_weights: true,
  },
  {
    owner: "mistralai",
    name: "mixtral-8x7b-instruct-v0.1",
    description: "Mixtral 8x7B Instruct: mixture-of-experts language model with broad knowledge",
    category: "llm",
    run_count: 20_000_000,
    is_open_weights: true,
  },
  // Audio / speech
  {
    owner: "meta",
    name: "musicgen",
    description: "MusicGen: music generation model for creating original music from text prompts",
    category: "speech_audio",
    run_count: 10_000_000,
    is_open_weights: true,
  },
  {
    owner: "openai",
    name: "whisper",
    description: "Whisper: automatic speech recognition model for transcribing audio to text",
    category: "speech_audio",
    run_count: 30_000_000,
    is_open_weights: true,
  },
  {
    owner: "suno-ai",
    name: "bark",
    description: "Bark: text-guided audio synthesis model capable of generating speech, music, and sound effects",
    category: "speech_audio",
    run_count: 8_000_000,
    is_open_weights: true,
  },
  // Vision / image processing
  {
    owner: "lucataco",
    name: "real-esrgan-x4-plus",
    description: "Real-ESRGAN x4+: image upscaling and enhancement using Real-ESRGAN super-resolution",
    category: "vision",
    run_count: 15_000_000,
    is_open_weights: true,
  },
  {
    owner: "andreasjansson",
    name: "clip-features",
    description: "CLIP Features: extract visual features and embeddings using OpenAI's CLIP model",
    category: "vision",
    run_count: 5_000_000,
    is_open_weights: true,
  },
  {
    owner: "cjwbw",
    name: "rembg",
    description: "Remove Background: automated background removal from images using segmentation",
    category: "vision",
    run_count: 20_000_000,
    is_open_weights: true,
  },
  {
    owner: "sczhou",
    name: "codeformer",
    description: "CodeFormer: robust face restoration and enhancement for old and degraded photos",
    category: "vision",
    run_count: 12_000_000,
    is_open_weights: true,
  },
  {
    owner: "tencentarc",
    name: "gfpgan",
    description: "GFPGAN: face restoration algorithm leveraging Generative Facial Prior for face enhancement",
    category: "vision",
    run_count: 18_000_000,
    is_open_weights: true,
  },
  // Identity & personalization
  {
    owner: "zsxkib",
    name: "instant-id",
    description: "InstantID: identity-preserving image generation with zero-shot personalization",
    category: "image_generation",
    run_count: 4_000_000,
    is_open_weights: true,
  },
  {
    owner: "fofr",
    name: "face-to-sticker",
    description: "Face to Sticker: convert any face into a sticker-style image using image generation",
    category: "image_generation",
    run_count: 6_000_000,
    is_open_weights: true,
  },
  // Multimodal
  {
    owner: "yorickvp",
    name: "llava-13b",
    description: "LLaVA 13B: large language and vision assistant for visual question answering and multimodal chat",
    category: "multimodal",
    run_count: 8_000_000,
    is_open_weights: true,
  },
  {
    owner: "daanelson",
    name: "minigpt-4",
    description: "MiniGPT-4: multimodal large language model capable of understanding images and generating text",
    category: "multimodal",
    run_count: 3_000_000,
    is_open_weights: true,
  },
  // Code
  {
    owner: "meta",
    name: "codellama-34b-instruct",
    description: "Code Llama 34B Instruct: instruction-following code generation model based on Llama 2",
    category: "code",
    run_count: 10_000_000,
    is_open_weights: true,
  },
  // Embeddings
  {
    owner: "nateraw",
    name: "bge-large-en-v1.5",
    description: "BGE Large EN v1.5: high-performance text embedding model for semantic search and retrieval",
    category: "embeddings",
    run_count: 2_000_000,
    is_open_weights: true,
  },
];

// ────────────────────────────────────────────────────────────────
// Replicate API response shapes
// ────────────────────────────────────────────────────────────────

interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: string;
  run_count: number;
  cover_image_url: string | null;
  latest_version: {
    id: string;
    created_at: string;
    cog_version: string;
    openapi_schema: unknown;
  } | null;
}

interface ReplicateListResponse {
  results: ReplicateModel[];
  next: string | null; // full cursor URL for next page
  previous: string | null;
}

// ────────────────────────────────────────────────────────────────
// Category inference from description keywords
// ────────────────────────────────────────────────────────────────

/** Infer our internal category from a Replicate model's description. */
function inferCategory(description: string | null): string {
  if (!description) return "specialized";

  const desc = description.toLowerCase();

  // Order matters -- more specific checks first
  if (
    desc.includes("text-to-video") ||
    desc.includes("video generation") ||
    desc.includes("video synthesis") ||
    desc.includes("animate")
  ) {
    return "video";
  }

  if (
    desc.includes("text-to-image") ||
    desc.includes("image generation") ||
    desc.includes("stable diffusion") ||
    desc.includes("diffusion model") ||
    desc.includes("generate image") ||
    desc.includes("img2img") ||
    desc.includes("image-to-image") ||
    desc.includes("inpainting")
  ) {
    return "image_generation";
  }

  if (
    desc.includes("object detection") ||
    desc.includes("image classification") ||
    desc.includes("image segmentation") ||
    desc.includes("image recognition") ||
    desc.includes("visual")
  ) {
    return "vision";
  }

  if (
    desc.includes("text-to-speech") ||
    desc.includes("speech-to-text") ||
    desc.includes("speech recognition") ||
    desc.includes("audio generation") ||
    desc.includes("music generation") ||
    desc.includes("voice clone") ||
    desc.includes("tts") ||
    desc.includes("asr")
  ) {
    return "speech_audio";
  }

  if (
    desc.includes("embedding") ||
    desc.includes("sentence similarity") ||
    desc.includes("vector")
  ) {
    return "embeddings";
  }

  if (
    desc.includes("multimodal") ||
    desc.includes("vision language") ||
    desc.includes("image and text")
  ) {
    return "multimodal";
  }

  if (
    desc.includes("code generation") ||
    desc.includes("code completion") ||
    desc.includes("programming")
  ) {
    return "code";
  }

  if (
    desc.includes("language model") ||
    desc.includes("llm") ||
    desc.includes("text generation") ||
    desc.includes("chat") ||
    desc.includes("conversational") ||
    desc.includes("instruction") ||
    desc.includes("gpt") ||
    desc.includes("llama") ||
    desc.includes("mistral")
  ) {
    return "llm";
  }

  return "specialized";
}

// ────────────────────────────────────────────────────────────────
// Transform a single Replicate model into our DB record shape
// ────────────────────────────────────────────────────────────────

function transformModel(model: ReplicateModel): Record<string, unknown> {
  const fullName = `${model.owner}/${model.name}`;
  const slug = makeSlug(fullName);
  const category = inferCategory(model.description);

  return {
    slug,
    name: model.name,
    provider: model.owner,
    category,
    description: model.description || null,
    status: "active",
    hf_downloads: model.run_count || 0, // store run_count as popularity metric
    is_api_available: true, // Replicate hosts runnable models
    is_open_weights: model.visibility === "public",
    release_date: model.latest_version?.created_at
      ? model.latest_version.created_at.split("T")[0]
      : null,
    data_refreshed_at: new Date().toISOString(),
    modalities: [],
    capabilities: {},
    supported_languages: [],
  };
}

/** Transform a KNOWN_MODELS entry into our DB record shape. */
function transformKnownModel(model: KnownModel): Record<string, unknown> {
  const fullName = `${model.owner}/${model.name}`;
  const slug = makeSlug(fullName);

  return {
    slug,
    name: model.name,
    provider: model.owner,
    category: model.category,
    description: model.description || null,
    status: "active",
    hf_downloads: model.run_count || 0,
    is_api_available: true,
    is_open_weights: model.is_open_weights,
    release_date: null,
    data_refreshed_at: new Date().toISOString(),
    modalities: [],
    capabilities: {},
    supported_languages: [],
  };
}

// ────────────────────────────────────────────────────────────────
// Adapter implementation
// ────────────────────────────────────────────────────────────────

const adapter: DataSourceAdapter = {
  id: "replicate",
  name: "Replicate",
  outputTypes: ["models"],
  defaultConfig: {
    maxPages: 10,
    rateLimitDelayMs: 250,
  },
  requiredSecrets: [],

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const maxPages = (ctx.config.maxPages as number) ?? 10;
    const rateLimitDelayMs = (ctx.config.rateLimitDelayMs as number) ?? 250;
    const token = ctx.secrets.REPLICATE_API_TOKEN;

    // ── Static fallback path (no token provided) ──────────────────
    if (!token) {
      const records = KNOWN_MODELS.map(transformKnownModel);

      let totalCreated = 0;
      const errors: SyncError[] = [];

      if (records.length > 0) {
        const { created, errors: upsertErrors } = await upsertBatch(
          ctx.supabase,
          "models",
          records,
          "slug"
        );
        totalCreated += created;
        errors.push(...upsertErrors);
      }

      return {
        success: true,
        recordsProcessed: records.length,
        recordsCreated: totalCreated,
        recordsUpdated: 0,
        errors,
        metadata: {
          source: "static_fallback",
          modelCount: records.length,
        },
      };
    }

    // ── Live API path (token provided) ────────────────────────────
    const rateLimitedFetch = createRateLimitedFetch(rateLimitDelayMs);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    const errors: SyncError[] = [];

    // First page URL; subsequent pages use the cursor URL from `next`
    let nextUrl: string | null = `${REPLICATE_API_BASE}/models`;
    let page = 0;

    while (nextUrl && page < maxPages) {
      // Respect abort signal
      if (ctx.signal?.aborted) {
        errors.push({ message: "Sync aborted by signal", context: `page=${page}` });
        break;
      }

      try {
        const res = await rateLimitedFetch(nextUrl, { headers }, ctx.signal);

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          errors.push({
            message: `Replicate API returned ${res.status}: ${body.slice(0, 200)}`,
            context: `page=${page}, url=${nextUrl}`,
          });
          // Stop on auth errors
          if (res.status === 401 || res.status === 403) {
            break;
          }
          // Attempt next page if cursor is available from a previous iteration
          // Since we can't get `next` from a failed response, we must stop
          break;
        }

        const data: ReplicateListResponse = await res.json();
        const models = data.results ?? [];

        if (models.length === 0) {
          break;
        }

        // Filter to public models only and transform
        const records = models
          .filter((m) => m.visibility === "public")
          .map(transformModel);

        totalProcessed += models.length;

        if (records.length > 0) {
          const { created, errors: upsertErrors } = await upsertBatch(
            ctx.supabase,
            "models",
            records,
            "slug"
          );
          totalCreated += created;
          errors.push(...upsertErrors);
        }

        // Progress tracked via SyncResult metadata

        // Advance to next cursor page
        nextUrl = data.next ?? null;
        page++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ message: msg, context: `page=${page}` });
        // On a network error we can't reliably continue because we don't
        // know the next cursor, so stop here.
        break;
      }
    }

    const nothingProcessed = totalProcessed === 0;

    return {
      success: !nothingProcessed,
      recordsProcessed: totalProcessed,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
      errors,
      cursor: nextUrl ?? undefined,
      metadata: {
        source: "live_api",
        maxPages,
        pagesFetched: page,
      },
    };
  },

  async healthCheck(secrets: Record<string, string>): Promise<HealthCheckResult> {
    const token = secrets.REPLICATE_API_TOKEN;
    if (!token) {
      // Without a token, the static fallback is always healthy
      return {
        healthy: true,
        latencyMs: 0,
        message: "No token — using static fallback data",
      };
    }

    const start = Date.now();
    try {
      const res = await fetchWithRetry(
        `${REPLICATE_API_BASE}/models?limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
        { maxRetries: 1 }
      );
      const latencyMs = Date.now() - start;

      if (!res.ok) {
        return {
          healthy: false,
          latencyMs,
          message: `Replicate API returned ${res.status}`,
        };
      }

      return { healthy: true, latencyMs };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};

registerAdapter(adapter);
export default adapter;
