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
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  source: string;
  lastUpdated: string;
}

// Prices as of March 2026. Input/Output per 1M tokens in USD.
export const KNOWN_PRICES: Record<string, ProviderPrice> = {
  // ─── OpenAI — Legacy ───────────────────────────────────────────
  "gpt-4o": { provider: "OpenAI", inputPricePerMillion: 2.50, outputPricePerMillion: 10.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4o-mini": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4-turbo": { provider: "OpenAI", inputPricePerMillion: 10.00, outputPricePerMillion: 30.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — GPT-4.1 family ───────────────────────────────────
  "gpt-4-1": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4.1": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4-1-mini": { provider: "OpenAI", inputPricePerMillion: 0.40, outputPricePerMillion: 1.60, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4.1-mini": { provider: "OpenAI", inputPricePerMillion: 0.40, outputPricePerMillion: 1.60, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4-1-nano": { provider: "OpenAI", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4.1-nano": { provider: "OpenAI", inputPricePerMillion: 0.10, outputPricePerMillion: 0.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — GPT-4.5 (deprecated preview) ────────────────────
  "gpt-4-5": { provider: "OpenAI", inputPricePerMillion: 75.00, outputPricePerMillion: 150.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-4.5": { provider: "OpenAI", inputPricePerMillion: 75.00, outputPricePerMillion: 150.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — GPT-5 family (CORRECTED) ─────────────────────────
  "gpt-5": { provider: "OpenAI", inputPricePerMillion: 1.25, outputPricePerMillion: 10.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-5-mini": { provider: "OpenAI", inputPricePerMillion: 0.25, outputPricePerMillion: 2.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "gpt-5-nano": { provider: "OpenAI", inputPricePerMillion: 0.15, outputPricePerMillion: 0.60, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

  // ─── OpenAI — o-series reasoning (CORRECTED) ──────────────────
  "o1": { provider: "OpenAI", inputPricePerMillion: 15.00, outputPricePerMillion: 60.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o1-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o1-pro": { provider: "OpenAI", inputPricePerMillion: 150.00, outputPricePerMillion: 600.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o3": { provider: "OpenAI", inputPricePerMillion: 2.00, outputPricePerMillion: 8.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o3-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o3-pro": { provider: "OpenAI", inputPricePerMillion: 20.00, outputPricePerMillion: 80.00, source: "openai.com/pricing", lastUpdated: "2026-03-01" },
  "o4-mini": { provider: "OpenAI", inputPricePerMillion: 1.10, outputPricePerMillion: 4.40, source: "openai.com/pricing", lastUpdated: "2026-03-01" },

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
