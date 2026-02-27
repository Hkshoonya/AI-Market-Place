// Seed script: Populates the database with well-known AI models
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

const SEED_MODELS = [
  // === LLMs ===
  {
    slug: "openai-gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    category: "llm",
    status: "active",
    short_description: "OpenAI's most advanced multimodal model with text, image, and audio capabilities.",
    description: "GPT-4o is OpenAI's flagship multimodal model. It accepts text, image, and audio inputs and produces text and audio outputs. 2x faster and 50% cheaper than GPT-4 Turbo while matching its performance.",
    architecture: "Transformer (Decoder-only)",
    parameter_count: 200_000_000_000,
    context_window: 128_000,
    release_date: "2024-05-13",
    hf_model_id: null,
    hf_downloads: 0,
    hf_likes: 0,
    license: "commercial",
    license_name: "Proprietary",
    is_open_weights: false,
    is_api_available: true,
    website_url: "https://openai.com/gpt-4o",
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko"],
    modalities: ["text", "image", "audio"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true },
    quality_score: 92.3,
    popularity_score: 95.1,
  },
  {
    slug: "anthropic-claude-4-sonnet",
    name: "Claude 4 Sonnet",
    provider: "Anthropic",
    category: "llm",
    status: "active",
    short_description: "Anthropic's balanced model with strong reasoning and 200K context window.",
    description: "Claude 4 Sonnet from Anthropic delivers an excellent balance of intelligence and speed. It excels at coding, analysis, and complex reasoning tasks with a 200K token context window.",
    architecture: "Transformer",
    parameter_count: null,
    context_window: 200_000,
    release_date: "2025-05-22",
    hf_model_id: null,
    hf_downloads: 0,
    hf_likes: 0,
    license: "commercial",
    license_name: "Proprietary",
    is_open_weights: false,
    is_api_available: true,
    website_url: "https://anthropic.com",
    supported_languages: ["en", "zh", "fr", "de", "es", "ja"],
    modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true, extended_thinking: true },
    quality_score: 91.8,
    popularity_score: 88.5,
  },
  {
    slug: "google-gemini-2-5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    category: "multimodal",
    status: "active",
    short_description: "Google's most capable thinking model with native multimodal understanding.",
    description: "Gemini 2.5 Pro is Google's most advanced AI model with native multimodal understanding across text, code, images, audio, and video. Features a 1M token context window.",
    architecture: "Transformer (MoE)",
    parameter_count: null,
    context_window: 1_000_000,
    release_date: "2025-03-25",
    hf_model_id: null,
    hf_downloads: 0,
    hf_likes: 0,
    license: "commercial",
    license_name: "Proprietary",
    is_open_weights: false,
    is_api_available: true,
    website_url: "https://deepmind.google/technologies/gemini",
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko", "hi"],
    modalities: ["text", "image", "audio", "video"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true, thinking: true },
    quality_score: 91.5,
    popularity_score: 87.2,
  },
  {
    slug: "deepseek-v3",
    name: "DeepSeek-V3",
    provider: "DeepSeek",
    category: "llm",
    status: "active",
    short_description: "685B parameter MoE model offering top performance at a fraction of the cost.",
    description: "DeepSeek-V3 is a 685B parameter Mixture-of-Experts model that achieves GPT-4 level performance at significantly lower cost. Activates 37B parameters per token.",
    architecture: "Transformer (MoE)",
    parameter_count: 685_000_000_000,
    context_window: 128_000,
    release_date: "2024-12-26",
    hf_model_id: "deepseek-ai/DeepSeek-V3",
    hf_downloads: 320_000_000,
    hf_likes: 28000,
    license: "open_source",
    license_name: "MIT",
    is_open_weights: true,
    is_api_available: true,
    website_url: "https://deepseek.com",
    github_url: "https://github.com/deepseek-ai/DeepSeek-V3",
    supported_languages: ["en", "zh"],
    modalities: ["text"],
    capabilities: { function_calling: true, json_mode: true, streaming: true },
    quality_score: 89.7,
    popularity_score: 82.3,
  },
  {
    slug: "meta-llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "Meta",
    category: "llm",
    status: "active",
    short_description: "Meta's open-weight 400B MoE model with multimodal native support.",
    description: "Llama 4 Maverick is Meta's flagship open model. A 400B parameter Mixture-of-Experts architecture with 17 experts, supporting text and image natively.",
    architecture: "Transformer (MoE)",
    parameter_count: 400_000_000_000,
    context_window: 1_048_576,
    release_date: "2025-04-05",
    hf_model_id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct",
    hf_downloads: 2_100_000_000,
    hf_likes: 52000,
    license: "open_source",
    license_name: "Llama 4 Community License",
    is_open_weights: true,
    is_api_available: true,
    website_url: "https://llama.meta.com",
    github_url: "https://github.com/meta-llama/llama4",
    supported_languages: ["en", "de", "fr", "it", "pt", "hi", "es", "th"],
    modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true, json_mode: true, streaming: true },
    quality_score: 88.9,
    popularity_score: 94.5,
  },
  {
    slug: "alibaba-qwen3-235b",
    name: "Qwen3-235B",
    provider: "Alibaba",
    category: "llm",
    status: "active",
    short_description: "Alibaba's largest open-weight model with hybrid thinking capabilities.",
    description: "Qwen3-235B-A22B is Alibaba's most powerful open model. A 235B parameter MoE with 22B active parameters and seamless switching between thinking and non-thinking modes.",
    architecture: "Transformer (MoE)",
    parameter_count: 235_000_000_000,
    context_window: 131_072,
    release_date: "2025-04-29",
    hf_model_id: "Qwen/Qwen3-235B-A22B",
    hf_downloads: 180_000_000,
    hf_likes: 15000,
    license: "open_source",
    license_name: "Apache 2.0",
    is_open_weights: true,
    is_api_available: true,
    github_url: "https://github.com/QwenLM/Qwen3",
    supported_languages: ["en", "zh", "fr", "es", "pt", "de", "it", "ru", "ja", "ko", "vi", "th", "ar"],
    modalities: ["text"],
    capabilities: { function_calling: true, json_mode: true, streaming: true, thinking: true },
    quality_score: 86.5,
    popularity_score: 76.8,
  },
  // === Image Generation ===
  {
    slug: "black-forest-labs-flux-1-pro",
    name: "FLUX.1 Pro",
    provider: "Black Forest Labs",
    category: "image_generation",
    status: "active",
    short_description: "State-of-the-art text-to-image model with exceptional prompt adherence.",
    description: "FLUX.1 Pro delivers photorealistic image generation with best-in-class prompt following, visual quality, and detail. Built by the team behind Stable Diffusion.",
    architecture: "Flow Matching Transformer",
    parameter_count: 12_000_000_000,
    context_window: null,
    release_date: "2024-08-01",
    hf_model_id: "black-forest-labs/FLUX.1-pro",
    hf_downloads: 450_000_000,
    hf_likes: 22000,
    license: "commercial",
    license_name: "Proprietary",
    is_open_weights: false,
    is_api_available: true,
    website_url: "https://blackforestlabs.ai",
    supported_languages: [],
    modalities: ["text-to-image"],
    capabilities: { inpainting: true, img2img: true },
    quality_score: 87.2,
    popularity_score: 79.5,
  },
  // === Speech/Audio ===
  {
    slug: "openai-whisper-large-v3",
    name: "Whisper Large V3",
    provider: "OpenAI",
    category: "speech_audio",
    status: "active",
    short_description: "Industry-leading open-source speech recognition model supporting 99+ languages.",
    description: "Whisper Large V3 is OpenAI's most capable speech recognition model. It achieves near-human level accuracy across 99+ languages and handles accents, background noise, and technical language.",
    architecture: "Transformer (Encoder-Decoder)",
    parameter_count: 1_550_000_000,
    context_window: null,
    release_date: "2023-11-06",
    hf_model_id: "openai/whisper-large-v3",
    hf_downloads: 670_000_000,
    hf_likes: 18000,
    license: "open_source",
    license_name: "Apache 2.0",
    is_open_weights: true,
    is_api_available: true,
    website_url: "https://openai.com/research/whisper",
    github_url: "https://github.com/openai/whisper",
    supported_languages: ["en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt"],
    modalities: ["audio-to-text"],
    capabilities: { translation: true, timestamps: true },
    quality_score: 85.8,
    popularity_score: 88.2,
  },
  // === Video ===
  {
    slug: "stability-stable-video-diffusion",
    name: "Stable Video Diffusion",
    provider: "Stability AI",
    category: "video",
    status: "active",
    short_description: "Open-source image-to-video generation model with high temporal consistency.",
    description: "Stable Video Diffusion generates short video clips from a single image input. It produces 14 or 25 frames at 576x1024 resolution with strong temporal consistency.",
    architecture: "Diffusion Transformer",
    parameter_count: 1_500_000_000,
    context_window: null,
    release_date: "2023-11-21",
    hf_model_id: "stabilityai/stable-video-diffusion-img2vid-xt",
    hf_downloads: 120_000_000,
    hf_likes: 12000,
    license: "research_only",
    license_name: "Stability AI Community License",
    is_open_weights: true,
    is_api_available: false,
    website_url: "https://stability.ai",
    github_url: "https://github.com/Stability-AI/generative-models",
    supported_languages: [],
    modalities: ["image-to-video"],
    capabilities: {},
    quality_score: 84.1,
    popularity_score: 71.3,
  },
  // === Code ===
  {
    slug: "meta-codellama-70b",
    name: "CodeLlama 70B",
    provider: "Meta",
    category: "code",
    status: "active",
    short_description: "Large-scale open-source code generation model supporting many programming languages.",
    description: "Code Llama 70B is a code-specialized large language model built on Llama 2. It supports code generation, completion, and infilling across popular programming languages.",
    architecture: "Transformer (Decoder-only)",
    parameter_count: 70_000_000_000,
    context_window: 100_000,
    release_date: "2024-01-29",
    hf_model_id: "meta-llama/CodeLlama-70b-hf",
    hf_downloads: 410_000_000,
    hf_likes: 25000,
    license: "open_source",
    license_name: "Llama 2 Community License",
    is_open_weights: true,
    is_api_available: true,
    github_url: "https://github.com/meta-llama/codellama",
    supported_languages: ["en"],
    modalities: ["text"],
    capabilities: { code_completion: true, infilling: true },
    quality_score: 83.5,
    popularity_score: 80.1,
  },
  // === Embeddings ===
  {
    slug: "openai-text-embedding-3-large",
    name: "text-embedding-3-large",
    provider: "OpenAI",
    category: "embeddings",
    status: "active",
    short_description: "OpenAI's most capable text embedding model with 3072 dimensions.",
    description: "text-embedding-3-large generates 3072-dimensional embeddings optimized for search, clustering, and classification tasks. Supports flexible dimensionality reduction.",
    architecture: "Transformer (Encoder)",
    parameter_count: null,
    context_window: 8_191,
    release_date: "2024-01-25",
    hf_model_id: null,
    hf_downloads: 0,
    hf_likes: 0,
    license: "commercial",
    license_name: "Proprietary",
    is_open_weights: false,
    is_api_available: true,
    website_url: "https://openai.com/blog/new-embedding-models-and-api-updates",
    supported_languages: ["en"],
    modalities: ["text"],
    capabilities: { dimensionality_reduction: true },
    quality_score: 82.0,
    popularity_score: 85.5,
  },
  // === Vision ===
  {
    slug: "google-gemma-3-27b",
    name: "Gemma 3 27B",
    provider: "Google",
    category: "llm",
    status: "active",
    short_description: "Google's powerful open model balancing capability and efficiency at 27B parameters.",
    description: "Gemma 3 27B is Google DeepMind's open model offering strong performance across text and image understanding. It features a 128K context window and strong multilingual support.",
    architecture: "Transformer (Decoder-only)",
    parameter_count: 27_000_000_000,
    context_window: 128_000,
    release_date: "2025-03-12",
    hf_model_id: "google/gemma-3-27b-it",
    hf_downloads: 560_000_000,
    hf_likes: 20000,
    license: "open_source",
    license_name: "Gemma License",
    is_open_weights: true,
    is_api_available: true,
    github_url: "https://github.com/google-deepmind/gemma",
    supported_languages: ["en", "zh", "fr", "de", "es", "ja", "ko"],
    modalities: ["text", "image"],
    capabilities: { function_calling: true, vision: true },
    quality_score: 81.5,
    popularity_score: 83.2,
  },
];

// Benchmark scores for the top models
const BENCHMARK_SCORES = [
  // GPT-4o
  { model_slug: "openai-gpt-4o", benchmark_slug: "mmlu", score: 88.7 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "humaneval", score: 90.2 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "math", score: 76.6 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "gpqa", score: 53.6 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "bbh", score: 83.4 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "hellaswag", score: 95.3 },
  { model_slug: "openai-gpt-4o", benchmark_slug: "arc", score: 96.4 },
  // Claude 4 Sonnet
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "mmlu", score: 87.4 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "humaneval", score: 92.0 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "math", score: 78.3 },
  { model_slug: "anthropic-claude-4-sonnet", benchmark_slug: "gpqa", score: 59.4 },
  // Gemini 2.5 Pro
  { model_slug: "google-gemini-2-5-pro", benchmark_slug: "mmlu", score: 86.9 },
  { model_slug: "google-gemini-2-5-pro", benchmark_slug: "humaneval", score: 88.5 },
  { model_slug: "google-gemini-2-5-pro", benchmark_slug: "math", score: 82.1 },
  // DeepSeek-V3
  { model_slug: "deepseek-v3", benchmark_slug: "mmlu", score: 85.3 },
  { model_slug: "deepseek-v3", benchmark_slug: "humaneval", score: 86.7 },
  { model_slug: "deepseek-v3", benchmark_slug: "math", score: 80.0 },
  // Llama 4 Maverick
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "mmlu", score: 84.1 },
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "humaneval", score: 85.3 },
  { model_slug: "meta-llama-4-maverick", benchmark_slug: "math", score: 75.2 },
];

// Pricing data
const PRICING_DATA = [
  { model_slug: "openai-gpt-4o", provider_name: "OpenAI", pricing_model: "token_based", input_price_per_million: 2.5, output_price_per_million: 10.0, median_output_tokens_per_second: 109, median_time_to_first_token: 0.23 },
  { model_slug: "openai-gpt-4o", provider_name: "Azure OpenAI", pricing_model: "token_based", input_price_per_million: 2.5, output_price_per_million: 10.0, median_output_tokens_per_second: 98, median_time_to_first_token: 0.31 },
  { model_slug: "anthropic-claude-4-sonnet", provider_name: "Anthropic", pricing_model: "token_based", input_price_per_million: 3.0, output_price_per_million: 15.0, median_output_tokens_per_second: 95, median_time_to_first_token: 0.28 },
  { model_slug: "google-gemini-2-5-pro", provider_name: "Google", pricing_model: "token_based", input_price_per_million: 1.25, output_price_per_million: 10.0, median_output_tokens_per_second: 120, median_time_to_first_token: 0.19 },
  { model_slug: "deepseek-v3", provider_name: "DeepSeek", pricing_model: "token_based", input_price_per_million: 0.27, output_price_per_million: 1.10, median_output_tokens_per_second: 145, median_time_to_first_token: 0.15 },
  { model_slug: "meta-llama-4-maverick", provider_name: "Together AI", pricing_model: "token_based", input_price_per_million: 0.27, output_price_per_million: 0.85, median_output_tokens_per_second: 88, median_time_to_first_token: 0.22 },
  { model_slug: "alibaba-qwen3-235b", provider_name: "Together AI", pricing_model: "token_based", input_price_per_million: 0.80, output_price_per_million: 2.40, median_output_tokens_per_second: 72, median_time_to_first_token: 0.28 },
  { model_slug: "openai-text-embedding-3-large", provider_name: "OpenAI", pricing_model: "token_based", input_price_per_million: 0.13, output_price_per_million: 0.0, median_output_tokens_per_second: null, median_time_to_first_token: null },
];

async function seed() {
  console.log("Seeding AI Market Cap database...\n");

  // 1. Insert models
  console.log(`Inserting ${SEED_MODELS.length} models...`);
  for (const model of SEED_MODELS) {
    const { error } = await supabase.from("models").upsert(
      {
        ...model,
        supported_languages: model.supported_languages,
        modalities: model.modalities,
        capabilities: model.capabilities,
      },
      { onConflict: "slug" }
    );
    if (error) {
      console.error(`  Error inserting ${model.name}:`, error.message);
    } else {
      console.log(`  Inserted: ${model.name} (${model.provider})`);
    }
  }

  // 2. Insert benchmark scores
  console.log(`\nInserting ${BENCHMARK_SCORES.length} benchmark scores...`);
  for (const bs of BENCHMARK_SCORES) {
    // Get model ID
    const { data: model } = await supabase
      .from("models")
      .select("id")
      .eq("slug", bs.model_slug)
      .single();

    // Get benchmark ID
    const { data: benchmark } = await supabase
      .from("benchmarks")
      .select("id")
      .eq("slug", bs.benchmark_slug)
      .single();

    if (model && benchmark) {
      const { error } = await supabase.from("benchmark_scores").upsert(
        {
          model_id: model.id,
          benchmark_id: benchmark.id,
          score: bs.score,
          score_normalized: bs.score / 100,
          source: "seed_data",
        },
        { onConflict: "model_id,benchmark_id,model_version" }
      );
      if (error) {
        console.error(`  Error: ${bs.model_slug}/${bs.benchmark_slug}:`, error.message);
      }
    }
  }
  console.log("  Benchmark scores inserted.");

  // 3. Insert pricing
  console.log(`\nInserting ${PRICING_DATA.length} pricing records...`);
  for (const pd of PRICING_DATA) {
    const { data: model } = await supabase
      .from("models")
      .select("id")
      .eq("slug", pd.model_slug)
      .single();

    if (model) {
      const { error } = await supabase.from("model_pricing").insert({
        model_id: model.id,
        provider_name: pd.provider_name,
        pricing_model: pd.pricing_model,
        input_price_per_million: pd.input_price_per_million,
        output_price_per_million: pd.output_price_per_million,
        median_output_tokens_per_second: pd.median_output_tokens_per_second,
        median_time_to_first_token: pd.median_time_to_first_token,
        source: "seed_data",
      });
      if (error && !error.message.includes("duplicate")) {
        console.error(`  Error pricing ${pd.model_slug}:`, error.message);
      }
    }
  }
  console.log("  Pricing data inserted.");

  // 4. Compute initial rankings
  console.log("\nComputing rankings...");
  const { data: allModels } = await supabase
    .from("models")
    .select("id, quality_score")
    .eq("status", "active")
    .order("quality_score", { ascending: false, nullsFirst: false });

  if (allModels) {
    for (let i = 0; i < allModels.length; i++) {
      const rank = i + 1;
      await supabase.from("rankings").upsert(
        {
          model_id: allModels[i].id,
          ranking_type: "overall",
          rank,
          score: allModels[i].quality_score,
        },
        { onConflict: "model_id,ranking_type" }
      );
      await supabase
        .from("models")
        .update({ overall_rank: rank })
        .eq("id", allModels[i].id);
    }
    console.log(`  Ranked ${allModels.length} models.`);
  }

  console.log("\nSeed complete!");
}

seed().catch(console.error);
