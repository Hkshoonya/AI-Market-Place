export const SUGGESTED_WALLET_TOP_UP_AMOUNTS = [20, 40, 60, 100] as const;

export const SUGGESTED_WALLET_TOP_UP_LABELS = SUGGESTED_WALLET_TOP_UP_AMOUNTS.map(
  (amount) => `$${amount}`
);

export function formatWalletTopUpList(labels = SUGGESTED_WALLET_TOP_UP_LABELS) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}
