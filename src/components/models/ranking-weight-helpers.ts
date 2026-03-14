// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankableModel {
  name: string;
  slug: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  category_rank: number | null;
  quality_score: number | null;
  value_score: number | null;
  is_open_weights: boolean;
  hf_downloads: number | null;
  popularity_score: number | null;
  adoption_rank: number | null;
  adoption_score: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  popularity_rank: number | null;
  economic_footprint_rank: number | null;
  economic_footprint_score: number | null;
  market_cap_estimate: number | null;
  capability_score: number | null;
  capability_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
}

export type WeightKey = "capability" | "economic_footprint" | "popularity" | "adoption" | "agent";

export interface WeightSignal {
  label: string;
  weight: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Weight signal definitions
// ---------------------------------------------------------------------------

export const DEFAULT_WEIGHTS: Record<WeightKey, WeightSignal> = {
  capability: {
    label: "Capability",
    weight: 30,
    description: "Technical benchmark and arena performance",
  },
  economic_footprint: {
    label: "Economic Footprint",
    weight: 25,
    description: "Adoption, monetization, distribution, and confidence",
  },
  popularity: {
    label: "Popularity",
    weight: 20,
    description: "Community attention, market traction, and durability",
  },
  adoption: {
    label: "Adoption",
    weight: 15,
    description: "Observed real-world usage and distribution reach",
  },
  agent: {
    label: "Agent Score",
    weight: 10,
    description: "Agentic task performance",
  },
};

export const WEIGHT_KEYS: WeightKey[] = [
  "capability",
  "economic_footprint",
  "popularity",
  "adoption",
  "agent",
];

export const MIN_WEIGHT = 0;
export const MAX_WEIGHT = 60;
export const STEP = 5;

// ---------------------------------------------------------------------------
// Helpers: raw-value accessor per signal key
// ---------------------------------------------------------------------------

export function getRawValue(model: RankableModel, key: WeightKey): number | null {
  switch (key) {
    case "capability":
      return model.capability_score;
    case "economic_footprint":
      return model.economic_footprint_score;
    case "popularity":
      return model.popularity_score;
    case "adoption":
      return model.adoption_score;
    case "agent":
      return model.agent_score;
  }
}

// ---------------------------------------------------------------------------
// Helpers: percentile ranking
// ---------------------------------------------------------------------------

/**
 * For a given signal key, compute a mapping from model slug to its percentile
 * rank (0 -- 100) among all models that have a non-null value. Models with
 * null values receive percentile 0 so they rank lowest on that axis.
 */
export function computePercentiles(
  models: RankableModel[],
  key: WeightKey,
): Map<string, number> {
  const values: { slug: string; value: number }[] = [];
  for (const m of models) {
    const v = getRawValue(m, key);
    if (v != null) {
      values.push({ slug: m.slug, value: v });
    }
  }

  // Sort ascending so lowest value gets rank 0, highest gets 100
  values.sort((a, b) => a.value - b.value);

  const count = values.length;
  const result = new Map<string, number>();

  // Assign null-value models a percentile of 0
  for (const m of models) {
    result.set(m.slug, 0);
  }

  if (count > 1) {
    for (let i = 0; i < count; i++) {
      const percentile = (i / (count - 1)) * 100;
      result.set(values[i].slug, percentile);
    }
  } else if (count === 1) {
    // Single non-null model gets 100
    result.set(values[0].slug, 100);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers: weight redistribution
// ---------------------------------------------------------------------------

/**
 * When one weight changes, redistribute the excess / deficit proportionally
 * across the remaining weights so the total stays at 100.
 *
 * - Clamps the changed weight to [MIN_WEIGHT, MAX_WEIGHT].
 * - Remaining weights are scaled proportionally.
 * - If all remaining weights are 0, distributes evenly.
 * - Each remaining weight is also clamped to [MIN_WEIGHT, MAX_WEIGHT].
 * - After clamping, any residual is distributed round-robin.
 */
export function redistributeWeights(
  current: Record<WeightKey, number>,
  changedKey: WeightKey,
  newValue: number,
): Record<WeightKey, number> {
  const clamped = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newValue));
  const remaining = 100 - clamped;
  const otherKeys = WEIGHT_KEYS.filter((k) => k !== changedKey);

  const otherSum = otherKeys.reduce((s, k) => s + current[k], 0);

  const result: Record<WeightKey, number> = { ...current, [changedKey]: clamped };

  if (otherSum === 0) {
    // Distribute remaining evenly
    const each = Math.floor(remaining / otherKeys.length);
    let leftover = remaining - each * otherKeys.length;
    for (const k of otherKeys) {
      result[k] = each + (leftover > 0 ? 1 : 0);
      if (leftover > 0) leftover--;
    }
  } else {
    // Proportional redistribution
    let distributed = 0;
    const rawOthers: { key: WeightKey; value: number }[] = otherKeys.map((k) => {
      const proportional = Math.round((current[k] / otherSum) * remaining);
      return { key: k, value: Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, proportional)) };
    });

    // First pass: assign clamped proportional values
    for (const item of rawOthers) {
      result[item.key] = item.value;
      distributed += item.value;
    }

    // Second pass: fix rounding residual
    let residual = remaining - distributed;
    let idx = 0;
    while (residual !== 0 && idx < otherKeys.length * 10) {
      const key = otherKeys[idx % otherKeys.length];
      const dir = residual > 0 ? 1 : -1;
      const next = result[key] + dir;
      if (next >= MIN_WEIGHT && next <= MAX_WEIGHT) {
        result[key] = next;
        residual -= dir;
      }
      idx++;
    }
  }

  return result;
}
