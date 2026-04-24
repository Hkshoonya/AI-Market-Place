/**
 * Curated provider pricing data.
 *
 * Maps known model slugs to official pricing from their providers.
 * This supplements the dynamic OpenRouter pricing with direct provider data.
 * Updated manually when providers change pricing (infrequent).
 *
 * Sources verified March 2026:
 *   - OpenAI:    developers.openai.com/api/docs/pricing
 *   - Anthropic: platform.claude.com/docs/en/about-claude/pricing
 *   - Google:    ai.google.dev/gemini-api/docs/pricing
 *   - DeepSeek:  api-docs.deepseek.com/quick_start/pricing
 *   - xAI:       docs.x.ai/developers/models
 *   - Cohere:    cohere.com/pricing
 *   - AI21:      docs.ai21.com/docs/inference-models
 *   - MiniMax:   platform.minimax.io/pricing
 *   - Mistral:   mistral.ai/pricing
 */

export interface ProviderPrice {
  provider: string;
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  pricePerCall?: number | null;
  pricePerGpuSecond?: number | null;
  subscriptionMonthly?: number | null;
  source: string;
  lastUpdated: string;
}

// Prices as of March 2026. Most entries are input/output token prices in USD;
// service-style models may use pricePerCall when the provider only publishes
// request/image pricing rather than token pricing.
export const KNOWN_PRICES: Record<string, ProviderPrice> = {
  // ─── OpenAI — Legacy ───────────────────────────────────────────
  "gpt-3-5-turbo": { provider: "OpenAI", inputPricePerMillion: 0.50, outputPricePerMillion: 1.50, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo": { provider: "OpenAI", inputPricePerMillion: 0.50, outputPricePerMillion: 1.50, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-turbo-0125": { provider: "OpenAI", inputPricePerMillion: 0.50, outputPricePerMillion: 1.50, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo-0125": { provider: "OpenAI", inputPricePerMillion: 0.50, outputPricePerMillion: 1.50, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-turbo-1106": { provider: "OpenAI", inputPricePerMillion: 1.00, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo-1106": { provider: "OpenAI", inputPricePerMillion: 1.00, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-turbo-0613": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo-0613": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-0301": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-0301": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-turbo-instruct": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo-instruct": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3-5-turbo-16k-0613": { provider: "OpenAI", inputPricePerMillion: 3.00, outputPricePerMillion: 4.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-3.5-turbo-16k-0613": { provider: "OpenAI", inputPricePerMillion: 3.00, outputPricePerMillion: 4.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-0125-preview": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4.0125-preview": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-1106-preview": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4.1106-preview": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-0613": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 60.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4.0613": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 60.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-0314": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 60.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4.0314": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 60.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-32k": { provider: "OpenAI", inputPricePerMillion: 60.00, outputPricePerMillion: 120.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-32k-0314": { provider: "OpenAI", inputPricePerMillion: 60.00, outputPricePerMillion: 120.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4-32k-0613": { provider: "OpenAI", inputPricePerMillion: 60.00, outputPricePerMillion: 120.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o": { provider: "OpenAI", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4o-mini": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4-turbo": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4-turbo-2024-04-09": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },

  // ─── OpenAI — GPT-4.1 family ───────────────────────────────────
  "gpt-4-1": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4.1": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4-1-mini": { provider: "OpenAI", inputPricePerMillion: 0.40, outputPricePerMillion: 1.60, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4.1-mini": { provider: "OpenAI", inputPricePerMillion: 0.40, outputPricePerMillion: 1.60, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4-1-nano": { provider: "OpenAI", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-4.1-nano": { provider: "OpenAI", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },

  // ─── OpenAI — GPT-4.5 (deprecated preview) ────────────────────
  "gpt-4-5": { provider: "OpenAI", inputPricePerMillion: 75.00, outputPricePerMillion: 150.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4.5": { provider: "OpenAI", inputPricePerMillion: 75.00, outputPricePerMillion: 150.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — GPT-5 family (CORRECTED) ─────────────────────────
  "gpt-5-5": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-04-24" },
  "gpt-5.5": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 30.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-04-24" },
  "gpt-5-5-pro": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 180.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-04-24" },
  "gpt-5.5-pro": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 180.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-04-24" },
  "gpt-5": { provider: "OpenAI", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-5-mini": { provider: "OpenAI", inputPricePerMillion: 0.25, outputPricePerMillion: 2.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-5-nano": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — o-series reasoning (CORRECTED) ──────────────────
  "o1": { provider: "OpenAI", inputPricePerMillion: 15.00, outputPricePerMillion: 60.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o1-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o1-pro": { provider: "OpenAI", inputPricePerMillion: 150.00, outputPricePerMillion: 600.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o3": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "o3-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o3-pro": { provider: "OpenAI", inputPricePerMillion: 20.00, outputPricePerMillion: 80.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o4-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-27" },
  "gpt-realtime": { provider: "OpenAI", inputPricePerMillion: 4.00, outputPricePerMillion: 16.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-realtime-mini": { provider: "OpenAI", inputPricePerMillion: 0.60, outputPricePerMillion: 2.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-audio": { provider: "OpenAI", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-audio-mini": { provider: "OpenAI", inputPricePerMillion: 0.60, outputPricePerMillion: 2.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-realtime-preview": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 20.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-mini-realtime-preview": { provider: "OpenAI", inputPricePerMillion: 0.60, outputPricePerMillion: 2.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-audio-preview": { provider: "OpenAI", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-mini-audio-preview": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-search-preview": { provider: "OpenAI", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-4o-mini-search-preview": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "computer-use-preview": { provider: "OpenAI", inputPricePerMillion: 3.00, outputPricePerMillion: 12.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-image-1-5": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "chatgpt-image-latest": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 10.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-image-1": { provider: "OpenAI", inputPricePerMillion: 5.00, outputPricePerMillion: 40.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "gpt-image-1-mini": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "tts-1": { provider: "OpenAI", inputPricePerMillion: 15.00, outputPricePerMillion: 0, source: "platform.openai.com/docs/models/tts-1", lastUpdated: "2026-03-17" },
  "tts-1-hd": { provider: "OpenAI", inputPricePerMillion: 30.00, outputPricePerMillion: 0, source: "platform.openai.com/docs/models/tts-1-hd", lastUpdated: "2026-03-17" },
  "text-embedding-3-small": { provider: "OpenAI", inputPricePerMillion: 0.02, outputPricePerMillion: 0, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "text-embedding-3-large": { provider: "OpenAI", inputPricePerMillion: 0.13, outputPricePerMillion: 0, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "text-embedding-ada-002": { provider: "OpenAI", inputPricePerMillion: 0.10, outputPricePerMillion: 0, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "davinci-002": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 2.00, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "babbage-002": { provider: "OpenAI", inputPricePerMillion: 0.40, outputPricePerMillion: 0.40, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "omni-moderation-latest": { provider: "OpenAI", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "omni-moderation-2024-09-26": { provider: "OpenAI", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },
  "codex-mini-latest": { provider: "OpenAI", inputPricePerMillion: 1.50, outputPricePerMillion: 6.00, source: "platform.openai.com/docs/models/codex-mini-latest", lastUpdated: "2026-03-17" },
  "dall-e-3": { provider: "OpenAI", inputPricePerMillion: null, outputPricePerMillion: null, pricePerCall: 0.04, source: "platform.openai.com/docs/pricing", lastUpdated: "2026-03-17" },

  // ─── Anthropic — Claude 3.x ────────────────────────────────────
  "claude-3-5-sonnet": { provider: "Anthropic", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-3-5-haiku": { provider: "Anthropic", inputPricePerMillion: 0.80, outputPricePerMillion: 4.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-3-opus": { provider: "Anthropic", inputPricePerMillion: 15.00, outputPricePerMillion: 75.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-3-haiku": { provider: "Anthropic", inputPricePerMillion: 0.25, outputPricePerMillion: 1.25, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },

  // ─── Anthropic — Claude 4.x (CORRECTED: Opus 4.5/4.6 dropped to $5/$25) ─
  "claude-4-opus": { provider: "Anthropic", inputPricePerMillion: 15.00, outputPricePerMillion: 75.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-4-sonnet": { provider: "Anthropic", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-opus-4": { provider: "Anthropic", inputPricePerMillion: 15.00, outputPricePerMillion: 75.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-opus-4-5": { provider: "Anthropic", inputPricePerMillion: 5.00, outputPricePerMillion: 25.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-opus-4-6": { provider: "Anthropic", inputPricePerMillion: 5.00, outputPricePerMillion: 25.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-4-5-sonnet": { provider: "Anthropic", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-sonnet-4-6": { provider: "Anthropic", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },
  "claude-haiku-4-5": { provider: "Anthropic", inputPricePerMillion: 1.00, outputPricePerMillion: 5.00, source: "anthropic.com/pricing", lastUpdated: "2026-03-01" },

  // ─── Google — Gemini (CORRECTED: 2.5 Flash is $0.30/$2.50) ────
  "gemini-2-0-flash": { provider: "Google", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-2-0-flash-lite": { provider: "Google", inputPricePerMillion: 0.075, outputPricePerMillion: 0.30, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-2-5-pro": { provider: "Google", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-2-5-flash": { provider: "Google", inputPricePerMillion: 0.30, outputPricePerMillion: 2.50, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-2-5-flash-lite": { provider: "Google", inputPricePerMillion: 0.075, outputPricePerMillion: 0.30, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  // Google — Gemini 3.x (assumed same tier as 2.5 equivalents)
  "gemini-3-pro": { provider: "Google", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-3-flash": { provider: "Google", inputPricePerMillion: 0.30, outputPricePerMillion: 2.50, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-1-5-pro": { provider: "Google", inputPricePerMillion: 1.25, outputPricePerMillion: 5.00, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },
  "gemini-1-5-flash": { provider: "Google", inputPricePerMillion: 0.075, outputPricePerMillion: 0.30, source: "ai.google.dev/pricing", lastUpdated: "2026-03-01" },

  // ─── Mistral (CORRECTED: Small is $0.20/$0.60) ────────────────
  "mistral-large": { provider: "Mistral", inputPricePerMillion: 2.00, outputPricePerMillion: 6.00, source: "mistral.ai/pricing", lastUpdated: "2026-03-01" },
  "mistral-small": { provider: "Mistral", inputPricePerMillion: 0.20, outputPricePerMillion: 0.60, source: "mistral.ai/pricing", lastUpdated: "2026-03-01" },
  "codestral": { provider: "Mistral", inputPricePerMillion: 0.30, outputPricePerMillion: 0.90, source: "mistral.ai/pricing", lastUpdated: "2026-03-01" },

  // ─── DeepSeek (CORRECTED: V3.2 unified pricing $0.28/$0.42) ───
  "deepseek-r1": { provider: "DeepSeek", inputPricePerMillion: 0.28, outputPricePerMillion: 0.42, source: "api-docs.deepseek.com/quick_start/pricing", lastUpdated: "2026-03-01" },
  "deepseek-v3": { provider: "DeepSeek", inputPricePerMillion: 0.28, outputPricePerMillion: 0.42, source: "api-docs.deepseek.com/quick_start/pricing", lastUpdated: "2026-03-01" },
  "deepseek-r1-0528": { provider: "DeepSeek", inputPricePerMillion: 0.28, outputPricePerMillion: 0.42, source: "api-docs.deepseek.com/quick_start/pricing", lastUpdated: "2026-03-01" },
  "deepseek-chat": { provider: "DeepSeek", inputPricePerMillion: 0.28, outputPricePerMillion: 0.42, source: "api-docs.deepseek.com/quick_start/pricing", lastUpdated: "2026-03-01" },
  "deepseek-reasoner": { provider: "DeepSeek", inputPricePerMillion: 0.28, outputPricePerMillion: 0.42, source: "api-docs.deepseek.com/quick_start/pricing", lastUpdated: "2026-03-01" },

  // ─── xAI — Grok ───────────────────────────────────────────────
  "grok-4": { provider: "xAI", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "docs.x.ai/developers/models", lastUpdated: "2026-03-17" },
  "grok-3": { provider: "xAI", inputPricePerMillion: 3.00, outputPricePerMillion: 15.00, source: "docs.x.ai/developers/models", lastUpdated: "2026-03-01" },
  "grok-3-mini": { provider: "xAI", inputPricePerMillion: 0.30, outputPricePerMillion: 0.50, source: "docs.x.ai/developers/models", lastUpdated: "2026-03-01" },
  "grok-2": { provider: "xAI", inputPricePerMillion: 2.00, outputPricePerMillion: 10.00, source: "x.ai/news/grok-1212", lastUpdated: "2026-03-17" },

  // ─── Cohere — Command family ──────────────────────────────────
  "command-r": { provider: "Cohere", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "cohere.com/pricing", lastUpdated: "2026-03-17" },
  "command-r-plus": { provider: "Cohere", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "cohere.com/pricing", lastUpdated: "2026-03-17" },
  "command-a": { provider: "Cohere", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "cohere.com/pricing", lastUpdated: "2026-03-17" },

  // ─── AI21 — Jamba family ──────────────────────────────────────
  "jamba-large": { provider: "AI21", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "docs.ai21.com/docs/inference-models", lastUpdated: "2026-03-17" },
  "jamba-mini": { provider: "AI21", inputPricePerMillion: 0.20, outputPricePerMillion: 0.40, source: "docs.ai21.com/docs/inference-models", lastUpdated: "2026-03-17" },
  "jamba-1-5-large": { provider: "AI21", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "docs.ai21.com/docs/inference-models", lastUpdated: "2026-03-17" },
  "jamba-1-5-mini": { provider: "AI21", inputPricePerMillion: 0.20, outputPricePerMillion: 0.40, source: "docs.ai21.com/docs/inference-models", lastUpdated: "2026-03-17" },

  // ─── MiniMax — M2.5 family ────────────────────────────────────
  "minimax-m2-5": { provider: "MiniMax", inputPricePerMillion: 0.30, outputPricePerMillion: 1.20, source: "platform.minimax.io/pricing", lastUpdated: "2026-03-17" },

  // ─── Amazon Nova ──────────────────────────────────────────────
  "nova-pro": { provider: "Amazon", inputPricePerMillion: 0.80, outputPricePerMillion: 3.20, source: "aws.amazon.com/blogs/machine-learning/prompting-for-the-best-price-performance", lastUpdated: "2026-03-17" },

  // ─── Google — newer Gemini tiers ─────────────────────────────
  "gemini-3-1-flash-lite": { provider: "Google", inputPricePerMillion: 0.25, outputPricePerMillion: 1.50, source: "blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-lite", lastUpdated: "2026-03-17" },

  // ─── Black Forest Labs — FLUX API pricing ────────────────────
  "flux-1-pro": { provider: "Black Forest Labs", inputPricePerMillion: null, outputPricePerMillion: null, pricePerCall: 0.05, source: "docs.bfl.ai/quick_start/pricing", lastUpdated: "2026-03-17" },

  // ─── Meta (open weights, listed at zero for self-hosted) ──────
  "llama-4-maverick": { provider: "Meta", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "open-weights", lastUpdated: "2026-03-01" },
  "llama-4-scout": { provider: "Meta", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "open-weights", lastUpdated: "2026-03-01" },
  "llama-3-1-405b": { provider: "Meta", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "open-weights", lastUpdated: "2026-03-01" },
  "llama-3-1-70b": { provider: "Meta", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "open-weights", lastUpdated: "2026-03-01" },
  "llama-3-1-8b": { provider: "Meta", inputPricePerMillion: 0, outputPricePerMillion: 0, source: "open-weights", lastUpdated: "2026-03-01" },
};

/**
 * Look up pricing for a model by slug.
 * Tries exact match first, then checks if the model slug contains a known pricing key.
 * Only matches in one direction (model slug contains known key) to avoid
 * short slugs like "o1" matching unrelated models like "audio-1".
 */
export function lookupProviderPrice(slug: string): ProviderPrice | null {
  // Exact match
  if (KNOWN_PRICES[slug]) return KNOWN_PRICES[slug];

  // Normalize slug for matching
  const normalizedSlug = slug.toLowerCase().replace(/[_\s]/g, "-");
  if (KNOWN_PRICES[normalizedSlug]) return KNOWN_PRICES[normalizedSlug];

  // Partial match: model slug contains a known pricing key at a word boundary.
  // Sort keys by length descending so longer (more specific) keys match first.
  const sortedKeys = Object.keys(KNOWN_PRICES).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    // Only match if the known key appears as a suffix or standalone segment in the slug
    // e.g. "anthropic-claude-4-opus" contains "claude-4-opus" ✓
    // but "gpt-4-1" should NOT match "o1" via key.includes(normalizedSlug)
    if (
      normalizedSlug === key ||
      normalizedSlug.endsWith("-" + key) ||
      normalizedSlug.startsWith(key + "-") ||
      normalizedSlug.includes("-" + key + "-")
    ) {
      return KNOWN_PRICES[key];
    }
  }

  return null;
}
