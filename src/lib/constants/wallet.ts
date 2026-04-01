export interface WalletTopUpPack {
  amount: 20 | 40 | 60 | 100;
  slug: "starter" | "builder" | "growth" | "scale";
  label: string;
  shortLabel: string;
  description: string;
}

export const WALLET_TOP_UP_PACKS: readonly WalletTopUpPack[] = [
  {
    amount: 20,
    slug: "starter",
    label: "Starter Pack",
    shortLabel: "Starter",
    description: "Best for trying one paid deployment path or subscription.",
  },
  {
    amount: 40,
    slug: "builder",
    label: "Builder Pack",
    shortLabel: "Builder",
    description: "A good fit for regular model usage across a couple of tools.",
  },
  {
    amount: 60,
    slug: "growth",
    label: "Growth Pack",
    shortLabel: "Growth",
    description: "Useful when you expect repeated API or plan usage this month.",
  },
  {
    amount: 100,
    slug: "scale",
    label: "Scale Pack",
    shortLabel: "Scale",
    description: "Best for heavier pay-as-you-go usage and multiple paid paths.",
  },
] as const;

export const SUGGESTED_WALLET_TOP_UP_AMOUNTS = WALLET_TOP_UP_PACKS.map(
  (pack) => pack.amount
) as readonly number[];

export const SUGGESTED_WALLET_TOP_UP_LABELS = SUGGESTED_WALLET_TOP_UP_AMOUNTS.map(
  (amount) => `$${amount}`
);

export function formatWalletTopUpList(labels = SUGGESTED_WALLET_TOP_UP_LABELS) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

export function getRecommendedWalletTopUpAmount(price: number | null | undefined) {
  if (price == null || !Number.isFinite(price) || price <= 0) return null;

  return (
    SUGGESTED_WALLET_TOP_UP_AMOUNTS.find((amount) => amount >= price) ??
    SUGGESTED_WALLET_TOP_UP_AMOUNTS.at(-1) ??
    null
  );
}

export function getWalletTopUpPackForAmount(price: number | null | undefined) {
  const amount = getRecommendedWalletTopUpAmount(price);
  if (amount == null) return null;

  return WALLET_TOP_UP_PACKS.find((pack) => pack.amount === amount) ?? null;
}
