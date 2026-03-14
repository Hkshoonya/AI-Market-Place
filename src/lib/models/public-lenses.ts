export type PublicRankingLens =
  | "capability"
  | "popularity"
  | "adoption"
  | "economic"
  | "value";

export interface PublicLensConfig {
  value: PublicRankingLens;
  label: string;
  description: string;
}

export const DEFAULT_PUBLIC_LENS: PublicRankingLens = "economic";

export const PUBLIC_LENS_CONFIG: PublicLensConfig[] = [
  {
    value: "capability",
    label: "Capability",
    description: "Pure benchmark and arena performance.",
  },
  {
    value: "popularity",
    label: "Popularity",
    description: "Community attention, market traction, adoption, and durability.",
  },
  {
    value: "adoption",
    label: "Adoption",
    description: "Observed practical usage and distribution footprint.",
  },
  {
    value: "economic",
    label: "Economic Footprint",
    description: "Adoption, monetization, distribution, and confidence combined.",
  },
  {
    value: "value",
    label: "Value",
    description: "Capability relative to cost for real buyers.",
  },
];

export function parsePublicRankingLens(value: string | null | undefined): PublicRankingLens {
  const normalized = (value ?? "").toLowerCase();
  return PUBLIC_LENS_CONFIG.some((lens) => lens.value === normalized)
    ? (normalized as PublicRankingLens)
    : DEFAULT_PUBLIC_LENS;
}

export function getPublicLensLabel(lens: PublicRankingLens): string {
  return PUBLIC_LENS_CONFIG.find((item) => item.value === lens)?.label ?? "Economic Footprint";
}

export function getPublicLensSort(lens: PublicRankingLens): {
  sortCol: string;
  ascending: boolean;
} {
  switch (lens) {
    case "capability":
      return { sortCol: "capability_rank", ascending: true };
    case "popularity":
      return { sortCol: "popularity_rank", ascending: true };
    case "adoption":
      return { sortCol: "adoption_rank", ascending: true };
    case "value":
      return { sortCol: "value_score", ascending: false };
    case "economic":
    default:
      return { sortCol: "economic_footprint_rank", ascending: true };
  }
}
