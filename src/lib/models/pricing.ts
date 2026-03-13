export interface PriceSortableModel {
  id: string;
  name: string;
  slug: string;
  overall_rank: number | null;
  is_open_weights?: boolean | null;
  model_pricing?: Array<{
    input_price_per_million: number | null;
  }> | null;
}

export function getLowestInputPrice(model: PriceSortableModel): number | null {
  const prices =
    model.model_pricing
      ?.map((pricing) => pricing.input_price_per_million)
      .filter((price): price is number => typeof price === "number") ?? [];

  if (prices.length > 0) {
    return Math.min(...prices);
  }

  return model.is_open_weights ? 0 : null;
}

export function compareModelsByLowestPrice(
  left: PriceSortableModel,
  right: PriceSortableModel
): number {
  const leftPrice = getLowestInputPrice(left);
  const rightPrice = getLowestInputPrice(right);

  if (leftPrice == null && rightPrice == null) {
    const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  }

  if (leftPrice == null) return 1;
  if (rightPrice == null) return -1;
  if (leftPrice !== rightPrice) return leftPrice - rightPrice;

  const leftRank = left.overall_rank ?? Number.MAX_SAFE_INTEGER;
  const rightRank = right.overall_rank ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank;
}
