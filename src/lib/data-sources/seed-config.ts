/**
 * Centralized configuration for all registered data source adapters.
 *
 * This is the single source of truth used by seedDataSources() to populate
 * the data_sources table on startup. Every adapter imported in registry.ts
 * must have a corresponding entry here.
 *
 * Field rules:
 *   - slug / adapter_type: must match the adapter's `id` field
 *   - tier: 1=2h, 2=4h, 3=8h, 4=24h (DB constraint: 1-4)
 *   - secret_env_keys: must match the adapter's requiredSecrets array
 *   - output_types: must match the adapter's outputTypes array
 *   - priority: lower number = runs first within a tier
 */

import type { SyncOutputType } from "./types";

export interface SeedEntry {
  slug: string;
  name: string;
  adapter_type: string;
  description: string | null;
  tier: number;
  sync_interval_hours: number;
  priority: number;
  secret_env_keys: string[];
  output_types: SyncOutputType[];
  is_enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * All 26 registered adapters, in registry.ts import order.
 * Tiers sourced from migration 015_tiered_sync_pg_cron.sql.
 * Priorities sourced from migration 002_enable_free_pipeline.sql.
 */
export const DATA_SOURCE_SEEDS: SeedEntry[] = [
  // ── Tier 1 (every 2h): Provider model catalogs ─────────────────────────
  {
    slug: "openrouter-models",
    name: "OpenRouter Models",
    adapter_type: "openrouter-models",
    description:
      "Primary model discovery: 400+ models with pricing and metadata from OpenRouter free API",
    tier: 1,
    sync_interval_hours: 2,
    priority: 5,
    secret_env_keys: [],
    output_types: ["models", "pricing"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "openai-models",
    name: "OpenAI Models",
    adapter_type: "openai-models",
    description: "Official OpenAI model catalog scraped from public API",
    tier: 1,
    sync_interval_hours: 2,
    priority: 25,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "anthropic-models",
    name: "Anthropic Models",
    adapter_type: "anthropic-models",
    description: "Official Anthropic model catalog scraped from public API",
    tier: 1,
    sync_interval_hours: 2,
    priority: 35,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "google-models",
    name: "Google Models",
    adapter_type: "google-models",
    description:
      "Official Google model catalog from Gemini API and AI Studio",
    tier: 1,
    sync_interval_hours: 2,
    priority: 45,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "z-ai-models",
    name: "Z.ai Models",
    adapter_type: "z-ai-models",
    description: "Official Z.ai model catalog scraped from public documentation",
    tier: 2,
    sync_interval_hours: 4,
    priority: 47,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "minimax-models",
    name: "MiniMax Models",
    adapter_type: "minimax-models",
    description: "Official MiniMax model catalog scraped from public documentation",
    tier: 2,
    sync_interval_hours: 4,
    priority: 48,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },

  // ── Tier 2 (every 4h): HF stats, benchmarks, ELO ────────────────────────
  {
    slug: "huggingface",
    name: "HuggingFace Hub",
    adapter_type: "huggingface",
    description:
      "HuggingFace model downloads, likes, and trending scores",
    tier: 2,
    sync_interval_hours: 4,
    priority: 15,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "replicate",
    name: "Replicate",
    adapter_type: "replicate",
    description:
      "Replicate model catalog with run counts and popularity metrics",
    tier: 2,
    sync_interval_hours: 4,
    priority: 55,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "artificial-analysis",
    name: "Artificial Analysis",
    adapter_type: "artificial-analysis",
    description:
      "Benchmark results and pricing data from Artificial Analysis API",
    tier: 2,
    sync_interval_hours: 4,
    priority: 20,
    secret_env_keys: [],
    output_types: ["benchmarks", "pricing"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "open-llm-leaderboard",
    name: "Open LLM Leaderboard",
    adapter_type: "open-llm-leaderboard",
    description:
      "HuggingFace Open LLM Leaderboard benchmark scores",
    tier: 2,
    sync_interval_hours: 4,
    priority: 30,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "chatbot-arena",
    name: "Chatbot Arena",
    adapter_type: "chatbot-arena",
    description:
      "LMSYS Chatbot Arena Elo ratings from human preference battles",
    tier: 2,
    sync_interval_hours: 4,
    priority: 40,
    secret_env_keys: [],
    output_types: ["elo_ratings"],
    is_enabled: true,
    config: {},
  },

  // ── Tier 3 (every 8h): News, pricing, and mid-frequency benchmarks ─────
  {
    slug: "arxiv",
    name: "arXiv Papers",
    adapter_type: "arxiv",
    description:
      "Recent AI/ML papers from arXiv for model announcement tracking",
    tier: 3,
    sync_interval_hours: 8,
    priority: 10,
    secret_env_keys: [],
    output_types: ["news"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "hf-papers",
    name: "HuggingFace Papers",
    adapter_type: "hf-papers",
    description: "Trending papers from HuggingFace Papers feed",
    tier: 3,
    sync_interval_hours: 8,
    priority: 15,
    secret_env_keys: [],
    output_types: ["news"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "github-trending",
    name: "GitHub Trending",
    adapter_type: "github-trending",
    description:
      "Trending AI repositories on GitHub for model discovery",
    tier: 3,
    sync_interval_hours: 8,
    priority: 20,
    secret_env_keys: [],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "civitai",
    name: "Civitai",
    adapter_type: "civitai",
    description: "Image generation model catalog from Civitai",
    tier: 3,
    sync_interval_hours: 8,
    priority: 25,
    secret_env_keys: ["CIVITAI_API_KEY"],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "provider-news",
    name: "Provider News",
    adapter_type: "provider-news",
    description:
      "Scrapes AI company blogs for model announcements and updates",
    tier: 2,
    sync_interval_hours: 4,
    priority: 5,
    secret_env_keys: [],
    output_types: ["news"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "x-announcements",
    name: "X.com Model Announcements",
    adapter_type: "x-announcements",
    description:
      "Monitors AI company X/Twitter accounts for model announcements via RSS",
    tier: 2,
    sync_interval_hours: 4,
    priority: 15,
    secret_env_keys: [],
    output_types: ["news"],
    is_enabled: true,
    config: { maxTweetsPerAccount: 10 },
  },
  {
    slug: "deployment-pricing",
    name: "Deployment Pricing",
    adapter_type: "deployment-pricing",
    description:
      "Deployment platform pricing data from major AI API providers",
    tier: 3,
    sync_interval_hours: 8,
    priority: 30,
    secret_env_keys: [],
    output_types: ["pricing"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "github-stars",
    name: "GitHub Stars",
    adapter_type: "github-stars",
    description:
      "GitHub star counts for open-source AI model repositories",
    tier: 3,
    sync_interval_hours: 8,
    priority: 35,
    secret_env_keys: ["GITHUB_TOKEN"],
    output_types: ["models"],
    is_enabled: true,
    config: {},
  },

  // ── Tier 3 (every 8h): Public benchmark leaderboards ────────────────────
  {
    slug: "livebench",
    name: "LiveBench",
    adapter_type: "livebench",
    description:
      "LiveBench contamination-free benchmark scores updated monthly",
    tier: 3,
    sync_interval_hours: 8,
    priority: 10,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "vision-arena",
    name: "Vision Arena",
    adapter_type: "vision-arena",
    description:
      "Arena vision leaderboard Elo ratings from the official site",
    tier: 2,
    sync_interval_hours: 4,
    priority: 42,
    secret_env_keys: [],
    output_types: ["elo_ratings"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "livecodebench",
    name: "LiveCodeBench",
    adapter_type: "livecodebench",
    description: "LiveCodeBench code-generation benchmark artifact feed",
    tier: 3,
    sync_interval_hours: 8,
    priority: 15,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "swe-bench",
    name: "SWE-Bench",
    adapter_type: "swe-bench",
    description: "SWE-Bench verified software-engineering benchmark results",
    tier: 3,
    sync_interval_hours: 8,
    priority: 18,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "arena-hard-auto",
    name: "Arena-Hard-Auto",
    adapter_type: "arena-hard-auto",
    description:
      "Arena-Hard-Auto official Gemini-judged preference leaderboard",
    tier: 3,
    sync_interval_hours: 8,
    priority: 19,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "seal-leaderboard",
    name: "SEAL Leaderboard",
    adapter_type: "seal-leaderboard",
    description: "SEAL instruction-following leaderboard scores",
    tier: 4,
    sync_interval_hours: 24,
    priority: 20,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: false,
    config: {},
  },
  {
    slug: "bigcode-leaderboard",
    name: "BigCode Leaderboard",
    adapter_type: "bigcode-leaderboard",
    description: "BigCode code generation benchmark leaderboard",
    tier: 3,
    sync_interval_hours: 8,
    priority: 30,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "open-vlm-leaderboard",
    name: "Open VLM Leaderboard",
    adapter_type: "open-vlm-leaderboard",
    description:
      "OpenCompass Visual Language Model leaderboard scores",
    tier: 3,
    sync_interval_hours: 8,
    priority: 40,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "aider-polyglot",
    name: "Aider Polyglot",
    adapter_type: "aider-polyglot",
    description: "Aider polyglot coding leaderboard from the official aider site",
    tier: 3,
    sync_interval_hours: 8,
    priority: 45,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },

  // ── Tier 4 (every 24h): Agent benchmark crawls ───────────────────────────
  {
    slug: "terminal-bench",
    name: "TerminalBench",
    adapter_type: "terminal-bench",
    description: "Terminal/CLI agent task benchmark scores",
    tier: 4,
    sync_interval_hours: 24,
    priority: 50,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "osworld",
    name: "OSWorld",
    adapter_type: "osworld",
    description: "Desktop GUI agent benchmark scores from OSWorld",
    tier: 4,
    sync_interval_hours: 24,
    priority: 60,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "gaia-benchmark",
    name: "GAIA Benchmark",
    adapter_type: "gaia-benchmark",
    description:
      "GAIA real-world assistant task benchmark scores",
    tier: 4,
    sync_interval_hours: 24,
    priority: 70,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "webarena",
    name: "WebArena",
    adapter_type: "webarena",
    description: "WebArena web browsing agent benchmark scores",
    tier: 4,
    sync_interval_hours: 24,
    priority: 80,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
  {
    slug: "tau-bench",
    name: "TAU-Bench",
    adapter_type: "tau-bench",
    description:
      "Tool-augmented understanding benchmark scores",
    tier: 4,
    sync_interval_hours: 24,
    priority: 90,
    secret_env_keys: [],
    output_types: ["benchmarks"],
    is_enabled: true,
    config: {},
  },
];
