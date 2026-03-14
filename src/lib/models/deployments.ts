export interface DeploymentPlatform {
  id: string;
  slug: string;
  name: string;
  type: string;
  base_url: string;
  has_affiliate: boolean;
  affiliate_url: string | null;
  affiliate_tag: string | null;
}

export interface ModelDeployment {
  id: string;
  deploy_url: string | null;
  pricing_model: string | null;
  price_per_unit: number | null;
  unit_description: string | null;
  free_tier: string | null;
  one_click: boolean;
  deployment_platforms: DeploymentPlatform;
}

export interface DeploymentCatalogItem {
  platform: DeploymentPlatform;
  deployment?: ModelDeployment;
  reason: string;
}

export interface DeploymentCatalogResult {
  directDeployments: DeploymentCatalogItem[];
  relatedPlatforms: DeploymentCatalogItem[];
}

const PRICING_PROVIDER_PLATFORM_SLUGS: Record<string, string> = {
  openai: "openai-api",
  openrouter: "openrouter",
  google: "google-ai-studio",
  anthropic: "anthropic-api",
  xai: "grok-premium",
  grok: "grok-premium",
  deepinfra: "deepinfra",
  fireworks: "fireworks",
  togetherai: "together-ai",
  "together ai": "together-ai",
  replicate: "replicate",
};

const PROVIDER_FAMILY_PLATFORMS: Record<string, string[]> = {
  openai: ["chatgpt-plus", "chatgpt-pro", "azure-ai"],
  google: ["gemini-advanced", "gcp-vertex"],
  anthropic: ["claude-pro", "aws-bedrock"],
  xai: ["grok-premium"],
};

const OPEN_WEIGHT_PLATFORMS = [
  "ollama",
  "llamacpp",
  "lm-studio",
  "runpod",
  "vast-ai",
  "lambda-cloud",
  "modal",
  "hf-inference",
  "replicate",
];

function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}

function pushRelatedPlatform(
  list: DeploymentCatalogItem[],
  seenIds: Set<string>,
  platform: DeploymentPlatform | undefined,
  reason: string
) {
  if (!platform || seenIds.has(platform.id)) return;
  seenIds.add(platform.id);
  list.push({ platform, reason });
}

export function buildDeploymentCatalog(input: {
  model: { slug: string; name: string; provider: string; is_open_weights: boolean | null };
  deployments: ModelDeployment[];
  platforms: DeploymentPlatform[];
  pricingProviderNames: string[];
}): DeploymentCatalogResult {
  const platformBySlug = new Map(input.platforms.map((platform) => [platform.slug, platform]));
  const seenPlatformIds = new Set<string>();

  const directDeployments = input.deployments.map((deployment) => {
    seenPlatformIds.add(deployment.deployment_platforms.id);
    return {
      platform: deployment.deployment_platforms,
      deployment,
      reason: "Model-specific deployment or pricing has been confirmed for this platform.",
    };
  });

  const relatedPlatforms: DeploymentCatalogItem[] = [];

  for (const providerName of input.pricingProviderNames) {
    const pricingSlug = PRICING_PROVIDER_PLATFORM_SLUGS[normalizeKey(providerName)];
    pushRelatedPlatform(
      relatedPlatforms,
      seenPlatformIds,
      pricingSlug ? platformBySlug.get(pricingSlug) : undefined,
      `Pricing was observed through ${providerName}, but a dedicated deployment manifest is not stored yet.`
    );
  }

  const providerFamily = PROVIDER_FAMILY_PLATFORMS[normalizeKey(input.model.provider)] ?? [];
  for (const slug of providerFamily) {
    pushRelatedPlatform(
      relatedPlatforms,
      seenPlatformIds,
      platformBySlug.get(slug),
      `Related first-party access path for ${input.model.provider}; confirm the exact model tier inside the platform.`
    );
  }

  if (input.model.is_open_weights) {
    for (const slug of OPEN_WEIGHT_PLATFORMS) {
      pushRelatedPlatform(
        relatedPlatforms,
        seenPlatformIds,
        platformBySlug.get(slug),
        "Compatible self-hosting or local runtime for open-weight models; deployment specifics depend on the artifact format you choose."
      );
    }
  }

  return { directDeployments, relatedPlatforms };
}
