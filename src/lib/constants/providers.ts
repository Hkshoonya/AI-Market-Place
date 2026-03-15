// Static provider brand data — used as fallback when DB data not available
// Matches the providers table in Supabase

export interface ProviderBrand {
  color: string;
  domain: string;
}

const PROVIDER_ALIASES: Record<string, string> = {
  ai21: "AI21 Labs",
  ai21labs: "AI21 Labs",
  alibabaqwen: "Qwen",
  anthropic: "Anthropic",
  blackforestlabs: "Black Forest Labs",
  cohere: "Cohere",
  databricks: "Databricks",
  deepseek: "DeepSeek",
  deepseekai: "DeepSeek",
  gemini: "Google",
  google: "Google",
  googledeepmind: "Google",
  huggingface: "Hugging Face",
  inflectionai: "Inflection AI",
  meta: "Meta",
  metaai: "Meta",
  mistral: "Mistral AI",
  mistralai: "Mistral AI",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  qwen: "Qwen",
  stabilityai: "Stability AI",
  togetherai: "Together AI",
  writer: "Writer",
  xai: "xAI",
  zhipuai: "Zhipu AI",
};

export const PROVIDER_BRANDS: Record<string, ProviderBrand> = {
  "OpenAI": { color: "#10a37f", domain: "openai.com" },
  "Anthropic": { color: "#D4A27F", domain: "anthropic.com" },
  "Google": { color: "#4285F4", domain: "google.com" },
  "Meta": { color: "#0866FF", domain: "meta.com" },
  "DeepSeek": { color: "#4D6CFA", domain: "deepseek.com" },
  "Stability AI": { color: "#7B61FF", domain: "stability.ai" },
  "Mistral AI": { color: "#F54E42", domain: "mistral.ai" },
  "Alibaba Cloud": { color: "#FF6A00", domain: "alibabacloud.com" },
  "Black Forest Labs": { color: "#FFFFFF", domain: "blackforestlabs.ai" },
  "Cohere": { color: "#39594D", domain: "cohere.com" },
  "Microsoft": { color: "#00A4EF", domain: "microsoft.com" },
  "NVIDIA": { color: "#76B900", domain: "nvidia.com" },
  "Together AI": { color: "#6366F1", domain: "together.ai" },
  "Hugging Face": { color: "#FFD21E", domain: "huggingface.co" },
  "AI21 Labs": { color: "#4B42F5", domain: "ai21.com" },
  "xAI": { color: "#FFFFFF", domain: "x.ai" },
  "Amazon": { color: "#FF9900", domain: "amazon.com" },
  "Apple": { color: "#A2AAAD", domain: "apple.com" },
  "Baidu": { color: "#2932E1", domain: "baidu.com" },
  "Zhipu AI": { color: "#4A90D9", domain: "zhipuai.cn" },
  "01.AI": { color: "#00BFA5", domain: "01.ai" },
  "Databricks": { color: "#FF3621", domain: "databricks.com" },
  "Inflection AI": { color: "#5856D6", domain: "inflection.ai" },
  "Reka AI": { color: "#FF6B6B", domain: "reka.ai" },
  "Writer": { color: "#7C3AED", domain: "writer.com" },
};

export function normalizeProviderKey(providerName: string | null | undefined): string {
  return (providerName ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getCanonicalProviderName(providerName: string | null | undefined): string {
  const trimmed = (providerName ?? "").trim();
  if (!trimmed) return "Unknown";

  const key = normalizeProviderKey(trimmed);
  if (!key) return "Unknown";

  const exactBrand = Object.keys(PROVIDER_BRANDS).find(
    (brand) => normalizeProviderKey(brand) === key
  );
  if (exactBrand) {
    return exactBrand;
  }

  if (PROVIDER_ALIASES[key]) {
    return PROVIDER_ALIASES[key];
  }

  return trimmed;
}

export function getProviderSlug(providerName: string | null | undefined): string {
  return getCanonicalProviderName(providerName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getLegacyProviderSlug(providerName: string | null | undefined): string {
  return (providerName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveProviderSlug(
  slug: string,
  providers: string[]
): string | null {
  const normalizedSlug = getLegacyProviderSlug(slug);
  const matched = providers.find((provider) => {
    const canonicalSlug = getProviderSlug(provider);
    const legacySlug = getLegacyProviderSlug(provider);
    return canonicalSlug === normalizedSlug || legacySlug === normalizedSlug;
  });

  return matched ? getCanonicalProviderName(matched) : null;
}

export function providerMatchesCanonical(
  providerName: string | null | undefined,
  canonicalProvider: string | null | undefined
): boolean {
  return getCanonicalProviderName(providerName) === getCanonicalProviderName(canonicalProvider);
}

/**
 * Look up provider brand data by provider name.
 * Tries exact match first, then case-insensitive partial match.
 */
export function getProviderBrand(providerName: string): ProviderBrand | null {
  const canonicalProvider = getCanonicalProviderName(providerName);

  // Exact match
  if (PROVIDER_BRANDS[canonicalProvider]) {
    return PROVIDER_BRANDS[canonicalProvider];
  }

  // Case-insensitive match
  const lowerName = canonicalProvider.toLowerCase();
  for (const [key, value] of Object.entries(PROVIDER_BRANDS)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Partial match (e.g., "Google DeepMind" matching "Google")
  for (const [key, value] of Object.entries(PROVIDER_BRANDS)) {
    if (
      lowerName.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lowerName)
    ) {
      return value;
    }
  }

  return null;
}
