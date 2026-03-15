export type AccessOfferKind = "subscription" | "api_access" | "deployment";

export interface AccessOfferPlatform {
  id: string;
  slug: string;
  name: string;
  type: string;
  base_url: string;
  has_affiliate: boolean;
  affiliate_url?: string | null;
  affiliate_tag?: string | null;
}

export interface AccessOfferDeployment {
  id: string;
  model_id: string;
  platform_id: string;
  pricing_model: string | null;
  price_per_unit: number | null;
  unit_description: string | null;
  free_tier: string | null;
  one_click: boolean;
  status?: string | null;
}

export interface AccessOfferModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  quality_score?: number | null;
  capability_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
}

export interface RankedAccessOffer {
  platform: AccessOfferPlatform;
  kind: AccessOfferKind;
  label: "Official" | "Verified" | "Related Access";
  actionLabel: "Subscribe" | "Start Free Trial" | "Get API Access" | "Deploy" | "View Plan";
  actionUrl: string;
  partnerDisclosure: string | null;
  monthlyPrice: number | null;
  monthlyPriceLabel: string;
  score: number;
  userValueScore: number;
  trustScore: number;
  affordabilityScore: number;
  utilityBreadthScore: number;
  modelCount: number;
  categoryCount: number;
  bestFor: string;
  topModels: Array<{
    slug: string;
    name: string;
    provider: string;
  }>;
  freeTier: string | null;
}

export interface AccessOffersCatalog {
  subscriptionOffers: RankedAccessOffer[];
  offersByModelId: Record<string, RankedAccessOffer[]>;
}

interface OfferSeed {
  platform: AccessOfferPlatform;
  deployments: AccessOfferDeployment[];
  models: AccessOfferModel[];
  kind: AccessOfferKind;
  monthlyPrice: number | null;
  freeTier: string | null;
  userValueScore: number;
  trustScore: number;
  affordabilityScore: number;
  utilityBreadthScore: number;
  bestFor: string;
  label: RankedAccessOffer["label"];
  actionLabel: RankedAccessOffer["actionLabel"];
  actionUrl: string;
  partnerDisclosure: string | null;
}

const CATEGORY_SUMMARIES: Record<string, string> = {
  llm: "general chat, reasoning, and writing",
  multimodal: "multimodal workflows",
  image: "image generation",
  video: "video generation",
  speech_audio: "speech and audio tasks",
  embeddings: "retrieval and search",
  embedding: "retrieval and search",
  agentic_browser: "browser agents and workflow automation",
  browser_automation: "browser agents and workflow automation",
  coding: "coding assistance",
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function getNumericScore(value: number | null | undefined): number {
  return value == null || !Number.isFinite(value) ? 0 : Number(value);
}

export function getAccessOfferActionLabel(
  kind: AccessOfferKind,
  freeTier: string | null
): RankedAccessOffer["actionLabel"] {
  if (freeTier) return "Start Free Trial";
  if (kind === "subscription") return "Subscribe";
  if (kind === "api_access") return "Get API Access";
  if (kind === "deployment") return "Deploy";
  return "View Plan";
}

export function getPartnerDisclosure(platform: AccessOfferPlatform): string | null {
  if (platform.has_affiliate || platform.affiliate_url) {
    return "Partner-supported link";
  }

  return null;
}

function getActionUrl(platform: AccessOfferPlatform): string {
  return platform.affiliate_url || platform.base_url;
}

function summarizeBestFor(models: AccessOfferModel[]): string {
  const categoryCounts = new Map<string, number>();

  for (const model of models) {
    categoryCounts.set(model.category, (categoryCounts.get(model.category) ?? 0) + 1);
  }

  const topCategories = Array.from(categoryCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([category]) => CATEGORY_SUMMARIES[category] ?? category.replace(/_/g, " "));

  if (topCategories.length === 0) {
    return "broad AI access";
  }

  if (topCategories.length === 1) {
    return topCategories[0];
  }

  return `${topCategories[0]} plus ${topCategories[1]}`;
}

export function inferAccessOfferKind(platform: Pick<AccessOfferPlatform, "type">): AccessOfferKind {
  if (platform.type === "subscription") return "subscription";
  if (platform.type === "api") return "api_access";
  return "deployment";
}

function buildOfferSeed(
  platform: AccessOfferPlatform,
  deployments: AccessOfferDeployment[],
  models: AccessOfferModel[]
): OfferSeed | null {
  const activeDeployments = deployments.filter(
    (deployment) => !deployment.status || deployment.status === "available"
  );

  if (activeDeployments.length === 0) return null;

  const kind = inferAccessOfferKind(platform);
  const priceCandidates = activeDeployments
    .filter(
      (deployment) =>
        deployment.price_per_unit != null &&
        Number.isFinite(deployment.price_per_unit) &&
        deployment.price_per_unit >= 0 &&
        (deployment.pricing_model === "monthly" || platform.type === "subscription")
    )
    .map((deployment) => Number(deployment.price_per_unit));

  const monthlyPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : null;
  const freeTier =
    activeDeployments.find((deployment) => deployment.free_tier)?.free_tier ?? null;

  const sortedModels = [...models].sort((left, right) => {
    const rightScore =
      getNumericScore(right.capability_score) * 0.6 +
      getNumericScore(right.economic_footprint_score) * 0.4;
    const leftScore =
      getNumericScore(left.capability_score) * 0.6 +
      getNumericScore(left.economic_footprint_score) * 0.4;
    return rightScore - leftScore;
  });

  const highlightedModels = sortedModels.slice(0, 5);
  const avgCapability =
    highlightedModels.length > 0
      ? highlightedModels.reduce(
          (sum, model) =>
            sum + Math.max(getNumericScore(model.capability_score), getNumericScore(model.quality_score)),
          0
        ) / highlightedModels.length
      : 0;
  const avgEconomic =
    highlightedModels.length > 0
      ? highlightedModels.reduce((sum, model) => sum + getNumericScore(model.economic_footprint_score), 0) /
        highlightedModels.length
      : 0;

  const categoryCount = new Set(models.map((model) => model.category).filter(Boolean)).size;
  const utilityBreadthScore = clamp(categoryCount * 18 + Math.log10(models.length + 1) * 22);
  const userValueScore = clamp(avgCapability * 0.55 + avgEconomic * 0.25 + utilityBreadthScore * 0.2);

  let trustScore = 50;
  if (platform.type === "subscription") trustScore += 25;
  if (monthlyPrice != null) trustScore += 15;
  if (models.length > 0) trustScore += 10;
  trustScore = clamp(trustScore);

  const label: RankedAccessOffer["label"] =
    platform.type === "subscription" ? "Official" : models.length > 0 ? "Verified" : "Related Access";

  return {
    platform,
    deployments: activeDeployments,
    models: sortedModels,
    kind,
    monthlyPrice,
    freeTier,
    userValueScore,
    trustScore,
    affordabilityScore: 0,
    utilityBreadthScore,
    bestFor: summarizeBestFor(sortedModels),
    label,
    actionLabel: getAccessOfferActionLabel(kind, freeTier),
    actionUrl: getActionUrl(platform),
    partnerDisclosure: getPartnerDisclosure(platform),
  };
}

function compareRankedAccessOffers(left: RankedAccessOffer, right: RankedAccessOffer): number {
  if (right.score !== left.score) return right.score - left.score;
  if ((left.monthlyPrice ?? Number.MAX_SAFE_INTEGER) !== (right.monthlyPrice ?? Number.MAX_SAFE_INTEGER)) {
    return (left.monthlyPrice ?? Number.MAX_SAFE_INTEGER) - (right.monthlyPrice ?? Number.MAX_SAFE_INTEGER);
  }
  return right.modelCount - left.modelCount;
}

function finalizeOfferScores(seeds: OfferSeed[]): RankedAccessOffer[] {
  const prices = seeds
    .map((seed) => seed.monthlyPrice)
    .filter((price): price is number => price != null && Number.isFinite(price));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  return seeds
    .map((seed) => {
      const affordabilityScore =
        seed.monthlyPrice == null
          ? 0
          : maxPrice === minPrice
            ? 100
            : clamp(((maxPrice - seed.monthlyPrice) / Math.max(maxPrice - minPrice, 1)) * 100);

      const score = clamp(
        seed.userValueScore * 0.45 +
          seed.trustScore * 0.25 +
          affordabilityScore * 0.2 +
          seed.utilityBreadthScore * 0.1
      );

      return {
        platform: seed.platform,
        kind: seed.kind,
        label: seed.label,
        actionLabel: seed.actionLabel,
        actionUrl: seed.actionUrl,
        partnerDisclosure: seed.partnerDisclosure,
        monthlyPrice: seed.monthlyPrice,
        monthlyPriceLabel:
          seed.monthlyPrice == null
            ? "Custom"
            : seed.monthlyPrice === 0
              ? "Free"
              : `$${seed.monthlyPrice.toFixed(0)}/mo`,
        score,
        userValueScore: seed.userValueScore,
        trustScore: seed.trustScore,
        affordabilityScore,
        utilityBreadthScore: seed.utilityBreadthScore,
        modelCount: seed.models.length,
        categoryCount: new Set(seed.models.map((model) => model.category).filter(Boolean)).size,
        bestFor: seed.bestFor,
        topModels: seed.models.slice(0, 3).map((model) => ({
          slug: model.slug,
          name: model.name,
          provider: model.provider,
        })),
        freeTier: seed.freeTier,
      } satisfies RankedAccessOffer;
    })
    .sort(compareRankedAccessOffers);
}

export function buildAccessOffersCatalog(input: {
  platforms: AccessOfferPlatform[];
  deployments: AccessOfferDeployment[];
  models: AccessOfferModel[];
}): AccessOffersCatalog {
  const modelsById = new Map(input.models.map((model) => [model.id, model]));
  const deploymentsByPlatform = new Map<string, AccessOfferDeployment[]>();

  for (const deployment of input.deployments) {
    const existing = deploymentsByPlatform.get(deployment.platform_id) ?? [];
    existing.push(deployment);
    deploymentsByPlatform.set(deployment.platform_id, existing);
  }

  const subscriptionSeeds: OfferSeed[] = [];
  const allSeeds: OfferSeed[] = [];

  for (const platform of input.platforms) {
    const platformDeployments = deploymentsByPlatform.get(platform.id) ?? [];
    if (platformDeployments.length === 0) continue;

    const kind = inferAccessOfferKind(platform);
    const isSubscriptionLike =
      kind === "subscription" ||
      platformDeployments.some((deployment) => deployment.pricing_model === "monthly");

    const platformModels = platformDeployments
      .map((deployment) => modelsById.get(deployment.model_id))
      .filter((model): model is AccessOfferModel => Boolean(model));

    const seed = buildOfferSeed(platform, platformDeployments, platformModels);
    if (seed) {
      allSeeds.push(seed);
    }

    if (seed && isSubscriptionLike) {
      subscriptionSeeds.push(seed);
    }
  }

  const offersByPlatformId = new Map(
    finalizeOfferScores(allSeeds).map((offer) => [offer.platform.id, offer])
  );
  const offersByModelId: Record<string, RankedAccessOffer[]> = {};

  for (const seed of allSeeds) {
    const offer = offersByPlatformId.get(seed.platform.id);
    if (!offer) continue;

    for (const model of seed.models) {
      const existing = offersByModelId[model.id] ?? [];
      existing.push(offer);
      offersByModelId[model.id] = existing;
    }
  }

  for (const [modelId, offers] of Object.entries(offersByModelId)) {
    offersByModelId[modelId] = [...offers].sort(compareRankedAccessOffers);
  }

  return {
    subscriptionOffers: finalizeOfferScores(subscriptionSeeds),
    offersByModelId,
  };
}

export function getBestAccessOfferForModel(
  catalog: AccessOffersCatalog,
  modelId: string
): RankedAccessOffer | null {
  return catalog.offersByModelId[modelId]?.[0] ?? null;
}
