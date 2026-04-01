import {
  getRecommendedWalletTopUpAmount,
  getWalletTopUpPackForAmount,
  type WalletTopUpPack,
} from "@/lib/constants/wallet";

export interface DeployStartOfferInput {
  actionLabel?: string | null;
  actionUrl?: string | null;
  monthlyPrice?: number | null;
  freeTier?: string | null;
  partnerDisclosure?: string | null;
  platform?: {
    slug?: string | null;
    name?: string | null;
    type?: string | null;
  } | null;
}

export interface DeployStartPlan {
  href: string;
  label: string;
  external: boolean;
  recommendedAmount: number | null;
  recommendedPack: WalletTopUpPack | null;
  recommendedPackReason: string | null;
  platformName: string | null;
  needsWallet: boolean;
  sponsored: boolean;
}

function getRecommendedPackReason(input: {
  actionLabel: string;
  monthlyPrice: number | null;
  platformName: string | null;
  platformType: string | null;
}) {
  if (input.platformType === "subscription") {
    return `Best when you want paid plan access through ${input.platformName ?? "the provider"}.`;
  }

  if (input.platformType === "api") {
    return `Best when you want credits ready for API usage through ${input.platformName ?? "the provider"}.`;
  }

  if (input.platformType === "hosting") {
    return `Best when you want to start a managed deployment path without extra setup.`;
  }

  if (input.monthlyPrice && input.monthlyPrice <= 20) {
    return `Best for trying one paid path without overfunding the wallet.`;
  }

  return `Best for getting through the first paid setup step without stopping to top up again.`;
}

function buildWalletStartHref(input: {
  modelSlug: string;
  modelName: string;
  actionLabel: string;
  offer: Required<Pick<DeployStartPlan, "recommendedAmount" | "platformName" | "sponsored">> &
    { actionUrl: string; recommendedPack?: WalletTopUpPack | null };
}) {
  const params = new URLSearchParams({
    intent: "deploy",
    model: input.modelName,
    modelSlug: input.modelSlug,
    action: input.actionLabel,
    next: input.offer.actionUrl,
  });

  if (input.offer.platformName) {
    params.set("provider", input.offer.platformName);
  }
  if (input.offer.recommendedAmount) {
    params.set("amount", String(input.offer.recommendedAmount));
  }
  if (input.offer.recommendedPack) {
    params.set("pack", input.offer.recommendedPack.slug);
    params.set("packLabel", input.offer.recommendedPack.label);
  }
  if (input.offer.sponsored) {
    params.set("sponsored", "1");
  }

  return `/wallet?${params.toString()}`;
}

export function getDeployStartPlan(input: {
  modelSlug: string;
  modelName: string;
  isOpenWeights?: boolean | null;
  offer?: DeployStartOfferInput | null;
}): DeployStartPlan | null {
  const offer = input.offer ?? null;
  const actionLabel = offer?.actionLabel ?? (input.isOpenWeights ? "Self-Host" : null);

  if (!actionLabel) return null;

  if (!offer?.actionUrl) {
    return {
      href: `/models/${input.modelSlug}?tab=deploy#model-tabs`,
      label: actionLabel,
      external: false,
      recommendedAmount: null,
      recommendedPack: null,
      recommendedPackReason: null,
      platformName: null,
      needsWallet: false,
      sponsored: false,
    };
  }

  const monthlyPrice =
    offer.monthlyPrice != null && Number.isFinite(offer.monthlyPrice)
      ? Number(offer.monthlyPrice)
      : null;
  const recommendedAmount =
    monthlyPrice != null && !offer.freeTier ? getRecommendedWalletTopUpAmount(monthlyPrice) : null;
  const recommendedPack =
    monthlyPrice != null && !offer.freeTier ? getWalletTopUpPackForAmount(monthlyPrice) : null;
  const platformName = offer.platform?.name ?? null;
  const platformType = offer.platform?.type ?? (offer.platform?.slug === "ollama-cloud" ? "hosting" : null);
  const sponsored = Boolean(offer.partnerDisclosure);

  if (recommendedAmount) {
    return {
      href: buildWalletStartHref({
        modelSlug: input.modelSlug,
        modelName: input.modelName,
        actionLabel,
        offer: {
          actionUrl: offer.actionUrl,
          recommendedAmount,
          recommendedPack,
          platformName,
          sponsored,
        },
      }),
      label: recommendedPack ? `Start with ${recommendedPack.label}` : `Start with Credits`,
      external: false,
      recommendedAmount,
      recommendedPack,
      recommendedPackReason: getRecommendedPackReason({
        actionLabel,
        monthlyPrice,
        platformName,
        platformType,
      }),
      platformName,
      needsWallet: true,
      sponsored,
    };
  }

  return {
    href: offer.actionUrl,
    label: actionLabel,
    external: true,
    recommendedAmount: null,
    recommendedPack: null,
    recommendedPackReason: null,
    platformName,
    needsWallet: false,
    sponsored,
  };
}
