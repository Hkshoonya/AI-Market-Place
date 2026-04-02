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
  confidence: "direct" | "pricing_inferred" | "provider_family" | "open_weight_runtime";
}

export interface DeploymentCatalogResult {
  directDeployments: DeploymentCatalogItem[];
  relatedPlatforms: DeploymentCatalogItem[];
}

export function summarizeUserVisibleDeploymentModes(
  items: DeploymentCatalogItem[],
  isOpenWeights: boolean | null | undefined
) {
  let hostedForYou = false;
  let cloudServerYouControl = false;
  let onYourComputer = false;

  for (const item of items) {
    const slug = item.platform.slug;
    const type = item.platform.type;

    if (slug === "ollama-cloud" || type === "hosting") {
      hostedForYou = true;
      continue;
    }

    if (slug === "runpod" || slug === "vast-ai" || slug === "lambda-cloud" || slug === "modal" || slug === "gcp-vertex" || type === "self-hosted") {
      cloudServerYouControl = true;
      continue;
    }

    if (slug === "ollama" || slug === "llamacpp" || slug === "lm-studio" || type === "local") {
      onYourComputer = true;
    }
  }

  if (!hostedForYou && !cloudServerYouControl && !onYourComputer && isOpenWeights) {
    cloudServerYouControl = true;
  }

  const labels: string[] = [];
  if (hostedForYou) labels.push("Hosted for you");
  if (cloudServerYouControl) labels.push("Cloud server you control");
  if (onYourComputer) labels.push("On your computer");

  return {
    hostedForYou,
    cloudServerYouControl,
    onYourComputer,
    labels,
  };
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
  "x.ai": ["grok-premium"],
  grok: ["grok-premium"],
  minimax: ["minimax-coding-plan"],
  minimaxai: ["minimax-coding-plan"],
  moonshotai: ["kimi-code-membership"],
  moonshot: ["kimi-code-membership"],
  kimi: ["kimi-code-membership"],
  "z.ai": ["glm-coding-plan"],
  "zai-org": ["glm-coding-plan"],
  glm: ["glm-coding-plan"],
};

function getProviderFamilyPlatformSlugs(input: {
  provider: string;
  is_open_weights: boolean | null | undefined;
}) {
  const providerKey = normalizeKey(input.provider);
  const base = PROVIDER_FAMILY_PLATFORMS[providerKey] ?? [];

  if (providerKey === "google" && input.is_open_weights) {
    return base.filter((slug) => slug !== "gemini-advanced");
  }

  return base;
}

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

function hasProviderFamilyAccessPath(
  provider: string,
  isOpenWeights: boolean | null | undefined,
  availablePlatformSlugs: Set<string>
): boolean {
  const providerFamily = getProviderFamilyPlatformSlugs({
    provider,
    is_open_weights: isOpenWeights,
  });
  return providerFamily.some((slug) => availablePlatformSlugs.has(slug));
}

function hasOpenWeightAccessPath(
  isOpenWeights: boolean | null | undefined,
  availablePlatformSlugs: Set<string>
): boolean {
  if (!isOpenWeights) return false;
  return OPEN_WEIGHT_PLATFORMS.some((slug) => availablePlatformSlugs.has(slug));
}

function pushRelatedPlatform(
  list: DeploymentCatalogItem[],
  seenIds: Set<string>,
  platform: DeploymentPlatform | undefined,
  reason: string,
  confidence: DeploymentCatalogItem["confidence"]
) {
  if (!platform || seenIds.has(platform.id)) return;
  seenIds.add(platform.id);
  list.push({ platform, reason, confidence });
}

function getDirectDeploymentReason(deployment: ModelDeployment) {
  const { deployment_platforms: platform } = deployment;

  if (platform.slug === "ollama") {
    return "Verified local Ollama runtime for this exact model.";
  }

  if (platform.slug === "ollama-cloud") {
    return "Verified managed Ollama Cloud runtime for this exact model.";
  }

  if (platform.type === "subscription") {
    return "Verified first-party subscription or plan access for this exact model.";
  }

  if (platform.type === "api") {
    return "Verified API access is available for this exact model.";
  }

  if (deployment.one_click) {
    return "Verified one-click deployment or hosted runtime for this exact model.";
  }

  return "Model-specific deployment or pricing has been confirmed for this platform.";
}

export function hasUserVisibleDeploymentAccess(input: {
  provider: string;
  is_open_weights: boolean | null | undefined;
  availablePlatformSlugs: Iterable<string>;
  hasDirectDeployment?: boolean;
}): boolean {
  if (input.hasDirectDeployment) return true;

  const platformSlugs =
    input.availablePlatformSlugs instanceof Set
      ? input.availablePlatformSlugs
      : new Set(input.availablePlatformSlugs);

  return (
    hasProviderFamilyAccessPath(input.provider, input.is_open_weights, platformSlugs) ||
    hasOpenWeightAccessPath(input.is_open_weights, platformSlugs)
  );
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
      reason: getDirectDeploymentReason(deployment),
      confidence: "direct" as const,
    };
  });

  const relatedPlatforms: DeploymentCatalogItem[] = [];

  for (const providerName of input.pricingProviderNames) {
    const pricingSlug = PRICING_PROVIDER_PLATFORM_SLUGS[normalizeKey(providerName)];
    pushRelatedPlatform(
      relatedPlatforms,
      seenPlatformIds,
      pricingSlug ? platformBySlug.get(pricingSlug) : undefined,
      `Pricing was observed through ${providerName}, but a dedicated deployment manifest is not stored yet.`,
      "pricing_inferred"
    );
  }

  const providerFamily = getProviderFamilyPlatformSlugs({
    provider: input.model.provider,
    is_open_weights: input.model.is_open_weights,
  });
  for (const slug of providerFamily) {
    const reason =
      input.model.provider === "Google" && input.model.is_open_weights && slug === "gcp-vertex"
        ? "Related Google Cloud path for private deployment of Gemma open-weight models; you still deploy and run the weights yourself."
        : `Related first-party access path for ${input.model.provider}; confirm the exact model tier inside the platform.`;
    pushRelatedPlatform(
      relatedPlatforms,
      seenPlatformIds,
      platformBySlug.get(slug),
      reason,
      "provider_family"
    );
  }

  if (input.model.is_open_weights) {
    for (const slug of OPEN_WEIGHT_PLATFORMS) {
      pushRelatedPlatform(
        relatedPlatforms,
        seenPlatformIds,
        platformBySlug.get(slug),
        "Compatible self-hosting or local runtime for open-weight models; deployment specifics depend on the artifact format you choose.",
        "open_weight_runtime"
      );
    }
  }

  return { directDeployments, relatedPlatforms };
}
