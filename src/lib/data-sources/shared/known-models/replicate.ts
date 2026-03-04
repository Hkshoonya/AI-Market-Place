/**
 * Replicate static model data.
 * Extracted from src/lib/data-sources/adapters/replicate.ts KNOWN_MODELS.
 *
 * Kept as an array (not a Record) because Replicate models are identified by
 * owner/name pairs (not a simple model ID), and the Replicate adapter uses
 * array iteration — not Object.keys() lookups.
 */

export interface KnownReplicateModel {
  owner: string;
  name: string;
  description: string;
  category: string;
  run_count: number;
  is_open_weights: boolean;
}

export const REPLICATE_KNOWN_MODELS: KnownReplicateModel[] = [
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
