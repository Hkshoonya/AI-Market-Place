// Formatting utilities for AI Market Cap

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "—";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatParams(params: number | null | undefined): string {
  if (params == null) return "—";
  if (params >= 1_000_000_000_000) return `${(params / 1_000_000_000_000).toFixed(1)}T`;
  if (params >= 1_000_000_000) return `${(params / 1_000_000_000).toFixed(0)}B`;
  if (params >= 1_000_000) return `${(params / 1_000_000).toFixed(0)}M`;
  return formatNumber(params);
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "—";
  if (price === 0) return "Free";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(2)}`;
}

export function formatTokenPrice(pricePerMillion: number | null | undefined): string {
  if (pricePerMillion == null) return "—";
  if (pricePerMillion === 0) return "Free";
  return `$${Number(pricePerMillion).toFixed(2)}`;
}

export function formatScore(score: number | null | undefined, maxScore = 100): string {
  if (score == null) return "—";
  if (maxScore === 100) return `${score.toFixed(1)}%`;
  return score.toFixed(1);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export function formatContextWindow(tokens: number | null | undefined): string {
  if (tokens == null) return "—";
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

export function getRankChange(current: number | null, previous: number | null): {
  direction: "up" | "down" | "same" | "new";
  amount: number;
} {
  if (previous == null) return { direction: "new", amount: 0 };
  if (current == null) return { direction: "same", amount: 0 };
  if (current < previous) return { direction: "up", amount: previous - current };
  if (current > previous) return { direction: "down", amount: current - previous };
  return { direction: "same", amount: 0 };
}

export function formatCurrency(
  price: number | null | undefined,
  currency = "USD"
): string {
  if (price == null) return "Contact";
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits: price < 1 ? 4 : 2,
  }).format(price);
}
