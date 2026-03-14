// --------------- Market Cap Formula Constants (CONST-01) ---------------

/** Scale factor calibrated so frontier commercial models land in a plausible nine-figure range. */
export const MARKET_CAP_SCALE_FACTOR = 1_200_000_000;

/** Exponent applied to usage score: usageScore^USAGE_EXPONENT */
export const USAGE_EXPONENT = 1.2;

/** Maximum price used for log-normalization: log10(price+1) / log10(MAX+1) */
export const MAX_PRICE_NORMALIZATION = 20;

/** Minimum effective price for free/open models (USD per 1M tokens) */
export const MIN_EFFECTIVE_PRICE = 0.10;

// --------------- Coverage Penalty Lookup Tables (CONST-02) ---------------

/**
 * Coverage penalty for popularity score (market-cap-calculator).
 * Maps signal count -> multiplier. Fewer signals = lower confidence.
 * Key "4" means "4 or more signals".
 */
export const POPULARITY_COVERAGE_PENALTY: Record<number, number> = {
  1: 0.50,
  2: 0.70,
  3: 0.85,
  4: 1.00,
};

/**
 * Coverage penalty for quality/expert calculators.
 * Maps evidence signal count -> multiplier.
 * Key "4" means "4 or more signals". 0 signals returns score 0 (handled by caller).
 */
export const EVIDENCE_COVERAGE_PENALTY: Record<number, number> = {
  0: 0,
  1: 0.40,
  2: 0.65,
  3: 0.85,
  4: 1.00,
};

/** Look up coverage penalty. Clamps count to table max. */
export function getCoveragePenalty(
  table: Record<number, number>,
  signalCount: number
): number {
  const maxKey = Math.max(...Object.keys(table).map(Number));
  const clampedCount = Math.min(signalCount, maxKey);
  return table[clampedCount] ?? 0;
}

// --------------- Provider Usage Estimates (CONST-03) ---------------

/**
 * Curated monthly active user estimates for major AI providers.
 * These are rough order-of-magnitude estimates used as a proxy signal.
 * Source: public reports, press releases, third-party analytics.
 *
 * Key: provider name (lowercase). Value: estimated monthly active users.
 */
export const PROVIDER_USAGE_ESTIMATES: Record<string, number> = {
  openai: 400_000_000,
  anthropic: 50_000_000,
  google: 200_000_000,
  meta: 100_000_000,
  mistral: 15_000_000,
  "mistral ai": 15_000_000,
  deepseek: 40_000_000,
  xai: 20_000_000,
  cohere: 5_000_000,
  amazon: 10_000_000,
  microsoft: 30_000_000,
  nvidia: 8_000_000,
  perplexity: 25_000_000,
  alibaba: 20_000_000,
  "alibaba cloud": 20_000_000,
  "alibaba / qwen": 20_000_000,
  qwen: 20_000_000,
  "stability ai": 10_000_000,
  "hugging face": 5_000_000,
  "ai21 labs": 3_000_000,
  "moonshot ai": 5_000_000,
  moonshotai: 5_000_000,
  "zhipu ai": 5_000_000,
  "01.ai": 3_000_000,
  "together ai": 2_000_000,
  databricks: 5_000_000,
  minimax: 5_000_000,
  minimaxai: 5_000_000,
};

/** Default monthly active users for unknown providers. */
export const DEFAULT_PROVIDER_MAU = 1_000_000;

/**
 * Look up the estimated monthly active users for a model's provider.
 * Falls back to DEFAULT_PROVIDER_MAU for unknown providers.
 */
export function getProviderUsageEstimate(providerName: string): number {
  const normalized = providerName.toLowerCase().trim();

  // Direct match
  if (PROVIDER_USAGE_ESTIMATES[normalized] !== undefined) {
    return PROVIDER_USAGE_ESTIMATES[normalized];
  }

  // Partial match
  for (const [key, value] of Object.entries(PROVIDER_USAGE_ESTIMATES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  // Default fallback for unknown providers
  return DEFAULT_PROVIDER_MAU;
}
