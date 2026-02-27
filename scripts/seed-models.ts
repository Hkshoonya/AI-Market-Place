// Seed script: Populates the database with comprehensive AI model data
// Run with: npx tsx scripts/seed-models.ts
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Models ────────────────────────────────────────────────────────────────────

interface SeedModel {
  slug: string;
  name: string;
  provider: string;
  category: string;
  status: string;
  short_description: string;
  description: string;
  architecture: string;
  parameter_count: number | null;
  context_window: number | null;
  release_date: string;
  license: string;
  license_name: string;
  is_open_weights: boolean;
  is_api_available: boolean;
  supported_languages: string[];
  modalities: string[];
  capabilities: Record<string, boolean>;
  provider_id: number | null;
  hf_downloads: number;
  hf_likes: number;
  quality_score: number;
  popularity_score: number;
  value_score?: number;
  website_url?: string;
  github_url?: string;
  hf_model_id?: string | null;
}

const SEED_MODELS: SeedModel[] = [
  // ── Top-tier LLMs ──
  {
    slug: "anthropic-claude-4-opus", name: "Claude 4 Opus", provider: "Anthropic", category: "llm", status: "active",
    short_description: "Most intelligent model for complex tasks",
    description: "Anthropic's most capable model, excelling at complex analysis, coding, math, and creative tasks with extended thinking.",
    architecture: "Transformer (dense)", parameter_count: null, context_window: 200000, release_date: "2025-05-22",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh","ko","pt","it","ru"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, analysis: true, math: true, creative_writing: true },
    provider_id: 2, hf_downloads: 0, hf_likes: 0, quality_score: 94.5, popularity_score: 86.2, value_score: 72.0,
  },
  {
    slug: "openai-gpt-4-5", name: "GPT-4.5", provider: "OpenAI", category: "llm", status: "active",
    short_description: "OpenAI frontier model with enhanced reasoning",
    description: "OpenAI's latest frontier model with improved reasoning, creativity, and factual accuracy.",
    architecture: "Transformer (MoE)", parameter_count: null, context_window: 128000, release_date: "2025-02-27",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh","ko","pt"], modalities: ["text","image"],
    capabilities: { reasoning: true, coding: true, analysis: true, vision: true },
    provider_id: 1, hf_downloads: 0, hf_likes: 0, quality_score: 93.1, popularity_score: 91.0, value_score: 68.5,
  },
  {
    slug: "openai-gpt-4o", name: "GPT-4o", provider: "OpenAI", category: "llm", status: "active",
    short_description: "OpenAI's most advanced multimodal model with text, image, and audio capabilities.",
    description: "GPT-4o is OpenAI's flagship multimodal model. It accepts text, image, and audio inputs and produces text and audio outputs. 2x faster and 50% cheaper than GPT-4 Turbo while matching its performance.",
    architecture: "Transformer (Decoder-only)", parameter_count: 200_000_000_000, context_window: 128_000, release_date: "2024-05-13",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko"], modalities: ["text", "image", "audio"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true },
    provider_id: 1, hf_downloads: 0, hf_likes: 0, quality_score: 92.3, popularity_score: 95.1, value_score: 80.0,
    website_url: "https://openai.com/gpt-4o",
  },
  {
    slug: "anthropic-claude-4-sonnet", name: "Claude 4 Sonnet", provider: "Anthropic", category: "llm", status: "active",
    short_description: "Anthropic's balanced model with strong reasoning and 200K context window.",
    description: "Claude 4 Sonnet from Anthropic delivers an excellent balance of intelligence and speed. It excels at coding, analysis, and complex reasoning tasks with a 200K token context window.",
    architecture: "Transformer", parameter_count: null, context_window: 200_000, release_date: "2025-05-22",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en", "zh", "fr", "de", "es", "ja"], modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true, extended_thinking: true },
    provider_id: 2, hf_downloads: 0, hf_likes: 0, quality_score: 91.8, popularity_score: 88.5, value_score: 85.0,
    website_url: "https://anthropic.com",
  },
  {
    slug: "google-gemini-2-5-pro", name: "Gemini 2.5 Pro", provider: "Google", category: "multimodal", status: "active",
    short_description: "Google's most capable thinking model with native multimodal understanding.",
    description: "Gemini 2.5 Pro is Google's most advanced AI model with native multimodal understanding across text, code, images, audio, and video. Features a 1M token context window.",
    architecture: "Transformer (MoE)", parameter_count: null, context_window: 1_000_000, release_date: "2025-03-25",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko", "hi"], modalities: ["text", "image", "audio", "video"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true, thinking: true },
    provider_id: 3, hf_downloads: 0, hf_likes: 0, quality_score: 91.5, popularity_score: 87.2, value_score: 82.0,
    website_url: "https://deepmind.google/technologies/gemini",
  },
  {
    slug: "deepseek-r1", name: "DeepSeek-R1", provider: "DeepSeek", category: "llm", status: "active",
    short_description: "Open reasoning model rivaling o1",
    description: "DeepSeek's reasoning-focused model trained with reinforcement learning, rivaling OpenAI o1 at a fraction of the cost.",
    architecture: "Transformer (MoE)", parameter_count: 671_000_000_000, context_window: 128000, release_date: "2025-01-20",
    license: "open_source", license_name: "MIT", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","zh"], modalities: ["text"],
    capabilities: { reasoning: true, math: true, coding: true, chain_of_thought: true },
    provider_id: 5, hf_downloads: 4500000, hf_likes: 12000, quality_score: 91.0, popularity_score: 93.8, value_score: 97.0,
  },
  {
    slug: "xai-grok-3", name: "Grok-3", provider: "xAI", category: "llm", status: "active",
    short_description: "xAI flagship with real-time knowledge",
    description: "xAI's most powerful model trained on real-time data with strong reasoning capabilities.",
    architecture: "Transformer (MoE)", parameter_count: null, context_window: 131072, release_date: "2025-02-18",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh"], modalities: ["text","image"],
    capabilities: { reasoning: true, coding: true, real_time_data: true, vision: true },
    provider_id: 16, hf_downloads: 0, hf_likes: 0, quality_score: 90.2, popularity_score: 78.5, value_score: 74.0,
  },
  {
    slug: "deepseek-v3", name: "DeepSeek-V3", provider: "DeepSeek", category: "llm", status: "active",
    short_description: "685B parameter MoE model offering top performance at a fraction of the cost.",
    description: "DeepSeek-V3 is a 685B parameter Mixture-of-Experts model that achieves GPT-4 level performance at significantly lower cost.",
    architecture: "Transformer (MoE)", parameter_count: 685_000_000_000, context_window: 128_000, release_date: "2024-12-26",
    license: "open_source", license_name: "MIT", is_open_weights: true, is_api_available: true,
    supported_languages: ["en", "zh"], modalities: ["text"],
    capabilities: { function_calling: true, json_mode: true, streaming: true },
    provider_id: 5, hf_downloads: 320_000, hf_likes: 28000, quality_score: 89.7, popularity_score: 82.3, value_score: 95.0,
    hf_model_id: "deepseek-ai/DeepSeek-V3",
  },
  {
    slug: "meta-llama-4-maverick", name: "Llama 4 Maverick", provider: "Meta", category: "llm", status: "active",
    short_description: "Meta's open-weight 400B MoE model with multimodal native support.",
    description: "Llama 4 Maverick is Meta's flagship open model. A 400B parameter Mixture-of-Experts architecture with 17 experts.",
    architecture: "Transformer (MoE)", parameter_count: 400_000_000_000, context_window: 1_048_576, release_date: "2025-04-05",
    license: "open_source", license_name: "Llama 4 Community License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en", "de", "fr", "it", "pt", "hi", "es", "th"], modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true },
    provider_id: 4, hf_downloads: 2_100_000, hf_likes: 52000, quality_score: 88.9, popularity_score: 94.5, value_score: 90.0,
  },
  {
    slug: "mistral-large-2", name: "Mistral Large 2", provider: "Mistral AI", category: "llm", status: "active",
    short_description: "Mistral flagship LLM",
    description: "Mistral's flagship large language model with strong multilingual and coding capabilities.",
    architecture: "Transformer (dense)", parameter_count: 123_000_000_000, context_window: 128000, release_date: "2024-07-24",
    license: "commercial", license_name: "Mistral Research License", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","it","pt","ru","zh","ja","ko","ar","hi"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, multilingual: true, function_calling: true },
    provider_id: 7, hf_downloads: 245000, hf_likes: 890, quality_score: 87.8, popularity_score: 74.5, value_score: 81.0,
  },
  // ── Mid-tier LLMs ──
  {
    slug: "meta-llama-3-3-70b", name: "Llama 3.3 70B", provider: "Meta", category: "llm", status: "active",
    short_description: "Cost-efficient 70B matching 405B quality",
    description: "Meta's efficient 70B parameter model matching Llama 3.1 405B performance at a fraction of the cost.",
    architecture: "Transformer (dense)", parameter_count: 70_000_000_000, context_window: 128000, release_date: "2024-12-06",
    license: "open_source", license_name: "Llama 3.3 Community License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","de","fr","it","pt","hi","es","th"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, multilingual: true, tool_use: true },
    provider_id: 4, hf_downloads: 3200000, hf_likes: 5800, quality_score: 86.8, popularity_score: 90.2, value_score: 92.0,
  },
  {
    slug: "alibaba-qwen3-235b", name: "Qwen3-235B", provider: "Alibaba", category: "llm", status: "active",
    short_description: "Alibaba's largest open-weight model with hybrid thinking capabilities.",
    description: "Qwen3-235B is Alibaba's most powerful open model with seamless switching between thinking and non-thinking modes.",
    architecture: "Transformer (MoE)", parameter_count: 235_000_000_000, context_window: 131_072, release_date: "2025-04-29",
    license: "open_source", license_name: "Apache 2.0", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","zh","fr","es","pt","de","it","ru","ja","ko","vi","th","ar"], modalities: ["text"],
    capabilities: { function_calling: true, json_mode: true, streaming: true, thinking: true },
    provider_id: 8, hf_downloads: 180_000, hf_likes: 15000, quality_score: 86.5, popularity_score: 76.8, value_score: 88.0,
  },
  {
    slug: "google-gemini-2-0-flash", name: "Gemini 2.0 Flash", provider: "Google", category: "multimodal", status: "active",
    short_description: "Fast multimodal model with tool use",
    description: "Google's fast and efficient multimodal model with native tool use and agentic capabilities.",
    architecture: "Transformer (MoE)", parameter_count: null, context_window: 1000000, release_date: "2025-02-05",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh","ko","pt","it","ru","ar","hi"], modalities: ["text","image","audio","video"],
    capabilities: { reasoning: true, coding: true, vision: true, tool_use: true, agentic: true },
    provider_id: 3, hf_downloads: 0, hf_likes: 0, quality_score: 86.0, popularity_score: 85.8, value_score: 93.5,
  },
  {
    slug: "alibaba-qwen2-5-72b", name: "Qwen2.5-72B", provider: "Alibaba", category: "llm", status: "active",
    short_description: "Strong open-weight multilingual LLM",
    description: "Alibaba's strong open-weight model with excellent multilingual and coding performance.",
    architecture: "Transformer (dense)", parameter_count: 72_000_000_000, context_window: 131072, release_date: "2024-09-19",
    license: "open_source", license_name: "Apache 2.0", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","zh","fr","de","es","ja","ko","ar","hi","ru"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, multilingual: true, math: true },
    provider_id: 8, hf_downloads: 2800000, hf_likes: 4500, quality_score: 85.8, popularity_score: 84.1, value_score: 91.0,
  },
  {
    slug: "xai-grok-2", name: "Grok-2", provider: "xAI", category: "llm", status: "active",
    short_description: "Second-gen reasoning with real-time data",
    description: "xAI's second-generation model with improved reasoning and real-time information access via X platform.",
    architecture: "Transformer (MoE)", parameter_count: null, context_window: 131072, release_date: "2024-08-13",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh"], modalities: ["text","image"],
    capabilities: { reasoning: true, coding: true, real_time_data: true, vision: true },
    provider_id: 16, hf_downloads: 0, hf_likes: 0, quality_score: 85.5, popularity_score: 72.0, value_score: 76.0,
  },
  {
    slug: "cohere-command-r-plus", name: "Command R+", provider: "Cohere", category: "llm", status: "active",
    short_description: "Enterprise RAG-optimized LLM",
    description: "Cohere's enterprise-grade model optimized for RAG, tool use, and multilingual tasks.",
    architecture: "Transformer (dense)", parameter_count: 104_000_000_000, context_window: 128000, release_date: "2024-04-04",
    license: "commercial", license_name: "CC-BY-NC-4.0", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","fr","de","es","it","pt","ru","zh","ja","ko","ar","hi"], modalities: ["text"],
    capabilities: { rag: true, tool_use: true, multilingual: true, coding: true },
    provider_id: 10, hf_downloads: 189000, hf_likes: 645, quality_score: 85.2, popularity_score: 68.3, value_score: 83.5,
  },
  {
    slug: "microsoft-phi-4", name: "Phi-4", provider: "Microsoft", category: "llm", status: "active",
    short_description: "Compact powerhouse for reasoning tasks",
    description: "Microsoft's compact yet powerful model achieving strong performance on reasoning and STEM benchmarks.",
    architecture: "Transformer (dense)", parameter_count: 14_000_000_000, context_window: 16384, release_date: "2024-12-12",
    license: "open_source", license_name: "MIT", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { reasoning: true, math: true, coding: true, stem: true },
    provider_id: 11, hf_downloads: 1850000, hf_likes: 3200, quality_score: 84.1, popularity_score: 82.5, value_score: 95.0,
  },
  {
    slug: "nvidia-nemotron-70b", name: "Nemotron 70B", provider: "NVIDIA", category: "llm", status: "active",
    short_description: "NVIDIA-optimized instruction-following LLM",
    description: "NVIDIA's optimized Llama-based model fine-tuned with synthetic data for strong instruction following.",
    architecture: "Transformer (dense)", parameter_count: 70_000_000_000, context_window: 32768, release_date: "2024-10-15",
    license: "open_source", license_name: "Llama 3.1 License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { reasoning: true, instruction_following: true, coding: true },
    provider_id: 12, hf_downloads: 620000, hf_likes: 1100, quality_score: 83.2, popularity_score: 62.5, value_score: 88.0,
  },
  {
    slug: "amazon-nova-pro", name: "Amazon Nova Pro", provider: "Amazon", category: "multimodal", status: "active",
    short_description: "Enterprise multimodal with cost efficiency",
    description: "Amazon's multimodal model optimized for enterprise use with strong accuracy-cost-speed balance.",
    architecture: "Transformer", parameter_count: null, context_window: 300000, release_date: "2024-12-03",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh","ko","pt","it","ar","hi"], modalities: ["text","image","video"],
    capabilities: { reasoning: true, vision: true, analysis: true, agentic: true },
    provider_id: 17, hf_downloads: 0, hf_likes: 0, quality_score: 83.0, popularity_score: 60.5, value_score: 88.5,
  },
  {
    slug: "ai21-jamba-1-5-large", name: "Jamba 1.5 Large", provider: "AI21 Labs", category: "llm", status: "active",
    short_description: "Hybrid SSM-Transformer for long context",
    description: "AI21's hybrid SSM-Transformer model combining Mamba with attention for efficient long-context processing.",
    architecture: "SSM-Transformer Hybrid (Mamba)", parameter_count: 398_000_000_000, context_window: 256000, release_date: "2024-08-22",
    license: "open_source", license_name: "Jamba Open Model License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en","fr","de","es","pt","it","ar","he"], modalities: ["text"],
    capabilities: { reasoning: true, long_context: true, efficient_inference: true },
    provider_id: 15, hf_downloads: 78000, hf_likes: 310, quality_score: 82.8, popularity_score: 55.2, value_score: 84.0,
  },
  {
    slug: "anthropic-claude-3-5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic", category: "llm", status: "active",
    short_description: "Fast and efficient for high-throughput tasks",
    description: "Anthropic's fastest model balancing speed and intelligence for high-throughput applications.",
    architecture: "Transformer (dense)", parameter_count: null, context_window: 200000, release_date: "2024-11-04",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","fr","de","es","ja","zh","ko","pt","it","ru"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, analysis: true, fast_inference: true },
    provider_id: 2, hf_downloads: 0, hf_likes: 0, quality_score: 82.5, popularity_score: 80.0, value_score: 94.0,
  },
  {
    slug: "google-gemma-3-27b", name: "Gemma 3 27B", provider: "Google", category: "llm", status: "active",
    short_description: "Google's powerful open model balancing capability and efficiency at 27B parameters.",
    description: "Gemma 3 27B is Google DeepMind's open model offering strong performance across text and image understanding.",
    architecture: "Transformer (Decoder-only)", parameter_count: 27_000_000_000, context_window: 128_000, release_date: "2025-03-12",
    license: "open_source", license_name: "Gemma License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko"], modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true },
    provider_id: 3, hf_downloads: 560_000, hf_likes: 20000, quality_score: 81.5, popularity_score: 83.2, value_score: 90.0,
  },
  {
    slug: "databricks-dbrx", name: "DBRX", provider: "Databricks", category: "llm", status: "active",
    short_description: "Enterprise-grade open MoE model",
    description: "Databricks' open MoE model optimized for enterprise use with strong code and language understanding.",
    architecture: "Transformer (MoE)", parameter_count: 132_000_000_000, context_window: 32768, release_date: "2024-03-27",
    license: "open_source", license_name: "Databricks Open Model License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { coding: true, analysis: true, enterprise: true },
    provider_id: 22, hf_downloads: 95000, hf_likes: 420, quality_score: 80.5, popularity_score: 58.2, value_score: 86.0,
  },
  {
    slug: "01ai-yi-lightning", name: "Yi-Lightning", provider: "01.AI", category: "llm", status: "active",
    short_description: "Fast, low-cost competitive LLM",
    description: "01.AI's fast and efficient model offering competitive performance at very low cost.",
    architecture: "Transformer (dense)", parameter_count: null, context_window: 16384, release_date: "2024-10-01",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en","zh"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, fast_inference: true },
    provider_id: 21, hf_downloads: 0, hf_likes: 0, quality_score: 80.0, popularity_score: 45.0, value_score: 92.0,
  },
  {
    slug: "google-gemma-2-9b", name: "Gemma 2 9B", provider: "Google", category: "llm", status: "active",
    short_description: "Efficient small model from Gemini distillation",
    description: "Google's efficient small model punching above its weight class with knowledge distillation from Gemini.",
    architecture: "Transformer (dense)", parameter_count: 9_000_000_000, context_window: 8192, release_date: "2024-06-27",
    license: "open_source", license_name: "Gemma Terms of Use", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { reasoning: true, coding: true, efficient: true },
    provider_id: 3, hf_downloads: 4100000, hf_likes: 5200, quality_score: 78.5, popularity_score: 86.5, value_score: 96.0,
  },
  // ── Image Generation ──
  {
    slug: "black-forest-labs-flux-1-pro", name: "FLUX.1 Pro", provider: "Black Forest Labs", category: "image_generation", status: "active",
    short_description: "State-of-the-art text-to-image model with exceptional prompt adherence.",
    description: "FLUX.1 Pro delivers photorealistic image generation with best-in-class prompt following, visual quality, and detail.",
    architecture: "Flow Matching Transformer", parameter_count: 12_000_000_000, context_window: null, release_date: "2024-08-01",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: [], modalities: ["text-to-image"],
    capabilities: { inpainting: true, img2img: true },
    provider_id: 9, hf_downloads: 450_000, hf_likes: 22000, quality_score: 87.2, popularity_score: 79.5, value_score: 78.0,
  },
  {
    slug: "openai-dall-e-3", name: "DALL-E 3", provider: "OpenAI", category: "image_generation", status: "active",
    short_description: "Advanced text-to-image generation",
    description: "OpenAI's state-of-the-art text-to-image generation model with improved prompt following and safety.",
    architecture: "Diffusion Transformer", parameter_count: null, context_window: null, release_date: "2023-10-03",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en"], modalities: ["text","image"],
    capabilities: { image_generation: true, prompt_following: true, inpainting: true },
    provider_id: 1, hf_downloads: 0, hf_likes: 0, quality_score: 86.0, popularity_score: 92.0, value_score: 75.0,
  },
  {
    slug: "stability-stable-diffusion-3-5", name: "Stable Diffusion 3.5", provider: "Stability AI", category: "image_generation", status: "active",
    short_description: "Open-weight photorealistic image generation",
    description: "Stability AI's latest open image generation model with MMDiT architecture for photorealistic outputs.",
    architecture: "MMDiT", parameter_count: 8_000_000_000, context_window: null, release_date: "2024-10-22",
    license: "open_source", license_name: "Stability AI Community License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text","image"],
    capabilities: { image_generation: true, photorealism: true, style_transfer: true },
    provider_id: 6, hf_downloads: 1200000, hf_likes: 2800, quality_score: 84.5, popularity_score: 80.3, value_score: 90.0,
  },
  // ── Specialized ──
  {
    slug: "openai-whisper-large-v3", name: "Whisper Large V3", provider: "OpenAI", category: "speech_audio", status: "active",
    short_description: "Industry-leading open-source speech recognition model supporting 99+ languages.",
    description: "Whisper Large V3 is OpenAI's most capable speech recognition model with near-human level accuracy across 99+ languages.",
    architecture: "Transformer (Encoder-Decoder)", parameter_count: 1_550_000_000, context_window: null, release_date: "2023-11-06",
    license: "open_source", license_name: "Apache 2.0", is_open_weights: true, is_api_available: true,
    supported_languages: ["en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt"], modalities: ["audio-to-text"],
    capabilities: { translation: true, timestamps: true },
    provider_id: 1, hf_downloads: 670_000, hf_likes: 18000, quality_score: 85.8, popularity_score: 88.2, value_score: 92.0,
  },
  {
    slug: "stability-stable-video-diffusion", name: "Stable Video Diffusion", provider: "Stability AI", category: "video", status: "active",
    short_description: "Open-source image-to-video generation model with high temporal consistency.",
    description: "Stable Video Diffusion generates short video clips from a single image input with strong temporal consistency.",
    architecture: "Diffusion Transformer", parameter_count: 1_500_000_000, context_window: null, release_date: "2023-11-21",
    license: "research_only", license_name: "Stability AI Community License", is_open_weights: true, is_api_available: false,
    supported_languages: [], modalities: ["image-to-video"],
    capabilities: {},
    provider_id: 6, hf_downloads: 120_000, hf_likes: 12000, quality_score: 84.1, popularity_score: 71.3, value_score: 80.0,
  },
  {
    slug: "meta-codellama-70b", name: "CodeLlama 70B", provider: "Meta", category: "code", status: "active",
    short_description: "Large-scale open-source code generation model supporting many programming languages.",
    description: "Code Llama 70B is a code-specialized large language model built on Llama 2 supporting code generation and completion.",
    architecture: "Transformer (Decoder-only)", parameter_count: 70_000_000_000, context_window: 100_000, release_date: "2024-01-29",
    license: "open_source", license_name: "Llama 2 Community License", is_open_weights: true, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { code_completion: true, infilling: true },
    provider_id: 4, hf_downloads: 410_000, hf_likes: 25000, quality_score: 83.5, popularity_score: 80.1, value_score: 88.0,
  },
  {
    slug: "openai-text-embedding-3-large", name: "text-embedding-3-large", provider: "OpenAI", category: "embeddings", status: "active",
    short_description: "OpenAI's most capable text embedding model with 3072 dimensions.",
    description: "text-embedding-3-large generates 3072-dimensional embeddings optimized for search, clustering, and classification.",
    architecture: "Transformer (Encoder)", parameter_count: null, context_window: 8_191, release_date: "2024-01-25",
    license: "commercial", license_name: "Proprietary", is_open_weights: false, is_api_available: true,
    supported_languages: ["en"], modalities: ["text"],
    capabilities: { dimensionality_reduction: true },
    provider_id: 1, hf_downloads: 0, hf_likes: 0, quality_score: 82.0, popularity_score: 85.5, value_score: 85.0,
  },
];

// ─── Benchmark scores (model_slug → benchmark_slug → score) ──────────────────

const BENCHMARK_SCORES: { model_slug: string; benchmark_slug: string; score: number }[] = [
  // Claude 4 Opus
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "mmlu", score: 90.2 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "humaneval", score: 95.1 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "math", score: 85.0 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "gpqa", score: 65.2 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "bbh", score: 89.5 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "hellaswag", score: 95.8 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "arc", score: 97.2 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "truthfulqa", score: 72.5 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "ifeval", score: 92.1 },
  { model_slug: "anthropic-claude-4-opus", benchmark_slug: "swe_bench", score: 53.8 },
  // GPT-4.5
  { model_slug: "openai-gpt-4-5", benchmark_slug: "mmlu", score: 90.8 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "humaneval", score: 91.5 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "math", score: 80.5 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "gpqa", score: 57.8 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "bbh", score: 87.2 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "hellaswag", score: 96.0 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "arc", score: 97.5 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "truthfulqa", score: 71.2 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "ifeval", score: 89.5 },
  { model_slug: "openai-gpt-4-5", benchmark_slug: "swe_bench", score: 38.5 },
  // GPT-4o
  { model_slug: "openai-gpt-4o", benchmark_slug: "mmlu", score: 88.7 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "humaneval", score: 90.2 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "math", score: 76.6 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "gpqa", score: 53.6 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "bbh", score: 83.4 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "hellaswag", score: 95.3 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "arc", score: 96.4 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "truthfulqa", score: 63.8 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "ifeval", score: 84.3 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "swe_bench", score: 33.2 },
  // Claude 4 Sonnet
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "mmlu", score: 87.4 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "humaneval", score: 92.0 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "math", score: 78.3 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "gpqa", score: 59.4 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "bbh", score: 86.2 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "ifeval", score: 88.6 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "swe_bench", score: 49.0 },
  // DeepSeek-R1
  { model_slug: "deepseek-r1", benchmark_slug: "mmlu", score: 90.8 },
  { model_slug: "deepseek-r1", benchmark_slug: "humaneval", score: 91.6 },
  { model_slug: "deepseek-r1", benchmark_slug: "math", score: 97.3 },
  { model_slug: "deepseek-r1", benchmark_slug: "gpqa", score: 71.5 },
  { model_slug: "deepseek-r1", benchmark_slug: "swe_bench", score: 49.2 },
  // Grok-3
  { model_slug: "xai-grok-3", benchmark_slug: "mmlu", score: 88.5 },
  { model_slug: "xai-grok-3", benchmark_slug: "humaneval", score: 89.2 },
  { model_slug: "xai-grok-3", benchmark_slug: "math", score: 81.5 },
  // DeepSeek-V3
  { model_slug: "deepseek-v3", benchmark_slug: "mmlu", score: 85.3 },
  { model_slug: "deepseek-v3", benchmark_slug: "humaneval", score: 86.7 },
  { model_slug: "deepseek-v3", benchmark_slug: "math", score: 80.0 },
  // Llama 4 Maverick
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "mmlu", score: 84.1 },
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "humaneval", score: 85.3 },
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "math", score: 75.2 },
];

// ─── Pricing data ────────────────────────────────────────────────────────────

const PRICING_DATA: {
  model_slug: string; provider_name: string; pricing_model: string;
  input_price_per_million: number | null; output_price_per_million: number | null;
  is_free_tier?: boolean;
}[] = [
  { model_slug: "anthropic-claude-4-opus", provider_name: "Anthropic", pricing_model: "token_based", input_price_per_million: 15.0, output_price_per_million: 75.0 },
  { model_slug: "openai-gpt-4-5", provider_name: "OpenAI", pricing_model: "token_based", input_price_per_million: 75.0, output_price_per_million: 150.0 },
  { model_slug: "openai-gpt-4o", provider_name: "OpenAI", pricing_model: "token_based", input_price_per_million: 2.5, output_price_per_million: 10.0 },
  { model_slug: "anthropic-claude-4-sonnet", provider_name: "Anthropic", pricing_model: "token_based", input_price_per_million: 3.0, output_price_per_million: 15.0 },
  { model_slug: "google-gemini-2-5-pro", provider_name: "Google", pricing_model: "token_based", input_price_per_million: 1.25, output_price_per_million: 10.0 },
  { model_slug: "deepseek-r1", provider_name: "DeepSeek", pricing_model: "token_based", input_price_per_million: 0.55, output_price_per_million: 2.19 },
  { model_slug: "xai-grok-3", provider_name: "xAI", pricing_model: "token_based", input_price_per_million: 3.0, output_price_per_million: 15.0 },
  { model_slug: "deepseek-v3", provider_name: "DeepSeek", pricing_model: "token_based", input_price_per_million: 0.27, output_price_per_million: 1.10 },
  { model_slug: "meta-llama-4-maverick", provider_name: "Together AI", pricing_model: "token_based", input_price_per_million: 0.27, output_price_per_million: 0.85 },
  { model_slug: "mistral-large-2", provider_name: "Mistral AI", pricing_model: "token_based", input_price_per_million: 2.0, output_price_per_million: 6.0 },
  { model_slug: "meta-llama-3-3-70b", provider_name: "Together AI", pricing_model: "token_based", input_price_per_million: 0.54, output_price_per_million: 0.54 },
  { model_slug: "google-gemini-2-0-flash", provider_name: "Google", pricing_model: "token_based", input_price_per_million: 0.10, output_price_per_million: 0.40, is_free_tier: true },
  { model_slug: "anthropic-claude-3-5-haiku", provider_name: "Anthropic", pricing_model: "token_based", input_price_per_million: 0.80, output_price_per_million: 4.0 },
  { model_slug: "cohere-command-r-plus", provider_name: "Cohere", pricing_model: "token_based", input_price_per_million: 2.5, output_price_per_million: 10.0 },
  { model_slug: "microsoft-phi-4", provider_name: "Together AI", pricing_model: "token_based", input_price_per_million: 0.10, output_price_per_million: 0.10 },
  { model_slug: "openai-text-embedding-3-large", provider_name: "OpenAI", pricing_model: "token_based", input_price_per_million: 0.13, output_price_per_million: 0.0 },
];

// ─── Elo ratings ──────────────────────────────────────────────────────────────

const ELO_RATINGS: { model_slug: string; elo_score: number; num_battles: number; rank: number }[] = [
  { model_slug: "anthropic-claude-4-opus", elo_score: 1350, num_battles: 28500, rank: 1 },
  { model_slug: "openai-gpt-4-5", elo_score: 1338, num_battles: 35000, rank: 2 },
  { model_slug: "deepseek-r1", elo_score: 1332, num_battles: 42000, rank: 3 },
  { model_slug: "xai-grok-3", elo_score: 1325, num_battles: 18500, rank: 4 },
  { model_slug: "google-gemini-2-5-pro", elo_score: 1318, num_battles: 31000, rank: 5 },
  { model_slug: "anthropic-claude-4-sonnet", elo_score: 1312, num_battles: 25000, rank: 6 },
  { model_slug: "openai-gpt-4o", elo_score: 1295, num_battles: 52000, rank: 7 },
  { model_slug: "deepseek-v3", elo_score: 1282, num_battles: 38000, rank: 8 },
  { model_slug: "meta-llama-4-maverick", elo_score: 1275, num_battles: 22000, rank: 9 },
  { model_slug: "xai-grok-2", elo_score: 1268, num_battles: 15000, rank: 10 },
  { model_slug: "alibaba-qwen3-235b", elo_score: 1262, num_battles: 19000, rank: 11 },
  { model_slug: "mistral-large-2", elo_score: 1255, num_battles: 16000, rank: 12 },
  { model_slug: "google-gemini-2-0-flash", elo_score: 1248, num_battles: 20000, rank: 13 },
  { model_slug: "meta-llama-3-3-70b", elo_score: 1242, num_battles: 24000, rank: 14 },
  { model_slug: "alibaba-qwen2-5-72b", elo_score: 1235, num_battles: 17000, rank: 15 },
];

// ─── Seed function ────────────────────────────────────────────────────────────

async function seed() {
  console.log("=== Seeding AI Market Cap database ===\n");

  // 1. Insert models
  console.log(`[1/5] Inserting ${SEED_MODELS.length} models...`);
  for (const model of SEED_MODELS) {
    const { error } = await supabase.from("models").upsert(model, { onConflict: "slug" });
    if (error) {
      console.error(`  ERROR ${model.name}: ${error.message}`);
    } else {
      console.log(`  OK ${model.name} (${model.provider})`);
    }
  }

  // 2. Benchmark scores
  console.log(`\n[2/5] Inserting ${BENCHMARK_SCORES.length} benchmark scores...`);
  let scoreCount = 0;
  for (const bs of BENCHMARK_SCORES) {
    const { data: model } = await supabase.from("models").select("id").eq("slug", bs.model_slug).single();
    const { data: bench } = await supabase.from("benchmarks").select("id").eq("slug", bs.benchmark_slug).single();
    if (model && bench) {
      const { error } = await supabase.from("benchmark_scores").upsert(
        { model_id: model.id, benchmark_id: bench.id, score: bs.score, score_normalized: bs.score / 100, source: "seed_data" },
        { onConflict: "model_id,benchmark_id,model_version" }
      );
      if (!error) scoreCount++;
    }
  }
  console.log(`  Inserted ${scoreCount} scores.`);

  // 3. Pricing
  console.log(`\n[3/5] Inserting ${PRICING_DATA.length} pricing records...`);
  for (const pd of PRICING_DATA) {
    const { data: model } = await supabase.from("models").select("id").eq("slug", pd.model_slug).single();
    if (model) {
      await supabase.from("model_pricing").insert({
        model_id: model.id, provider_name: pd.provider_name, pricing_model: pd.pricing_model,
        input_price_per_million: pd.input_price_per_million, output_price_per_million: pd.output_price_per_million,
        is_free_tier: pd.is_free_tier ?? false, source: "seed_data",
      });
    }
  }
  console.log("  Done.");

  // 4. Elo ratings
  console.log(`\n[4/5] Inserting ${ELO_RATINGS.length} elo ratings...`);
  for (const er of ELO_RATINGS) {
    const { data: model } = await supabase.from("models").select("id").eq("slug", er.model_slug).single();
    if (model) {
      await supabase.from("elo_ratings").insert({
        model_id: model.id, arena_name: "Chatbot Arena", elo_score: er.elo_score,
        confidence_interval_low: er.elo_score - 10, confidence_interval_high: er.elo_score + 10,
        num_battles: er.num_battles, rank: er.rank, snapshot_date: new Date().toISOString().split("T")[0],
      });
    }
  }
  console.log("  Done.");

  // 5. Compute rankings
  console.log("\n[5/5] Computing rankings...");
  const { data: allModels } = await supabase
    .from("models").select("id, quality_score").eq("status", "active")
    .order("quality_score", { ascending: false, nullsFirst: false });

  if (allModels) {
    for (let i = 0; i < allModels.length; i++) {
      const rank = i + 1;
      await supabase.from("rankings").upsert(
        { model_id: allModels[i].id, ranking_type: "overall", rank, score: allModels[i].quality_score },
        { onConflict: "model_id,ranking_type" }
      );
      await supabase.from("models").update({ overall_rank: rank }).eq("id", allModels[i].id);
    }
    console.log(`  Ranked ${allModels.length} models.`);
  }

  console.log("\n=== Seed complete! ===");
}

seed().catch(console.error);
