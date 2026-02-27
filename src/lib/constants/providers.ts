// Static provider brand data — used as fallback when DB data not available
// Matches the providers table in Supabase

export interface ProviderBrand {
  color: string;
  domain: string;
}

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

/**
 * Look up provider brand data by provider name.
 * Tries exact match first, then case-insensitive partial match.
 */
export function getProviderBrand(providerName: string): ProviderBrand | null {
  // Exact match
  if (PROVIDER_BRANDS[providerName]) {
    return PROVIDER_BRANDS[providerName];
  }

  // Case-insensitive match
  const lowerName = providerName.toLowerCase();
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
