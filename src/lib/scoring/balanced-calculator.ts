/**
 * Balanced Ranking Calculator (Lens 4)
 *
 * Meta-ranking that blends the other 3 lenses plus value.
 *
 * Formula:
 *   balancedRank = capabilityRank * cW + usageRank * uW + expertRank * eW + valueRank * vW
 *
 * Category-specific weights ensure image gen doesn't get ranked by LLM-heavy signals.
 */

interface BalancedWeights {
  capability: number;
  usage: number;
  expert: number;
  value: number;
}

const CATEGORY_BALANCED_WEIGHTS: Record<string, BalancedWeights> = {
  llm:              { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
  code:             { capability: 0.40, usage: 0.25, expert: 0.25, value: 0.10 },
  image_generation: { capability: 0.20, usage: 0.40, expert: 0.30, value: 0.10 },
  multimodal:       { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
  agentic_browser:  { capability: 0.40, usage: 0.25, expert: 0.25, value: 0.10 },
  default:          { capability: 0.35, usage: 0.30, expert: 0.25, value: 0.10 },
};

interface ModelRanks {
  id: string;
  category: string;
  capabilityRank: number | null;
  usageRank: number;
  expertRank: number;
  valueRank: number | null;
  rankPenalty?: number;
}

/**
 * Compute balanced rankings for all models.
 * Unranked models (null capabilityRank) use worst-case rank for that signal.
 */
export function computeBalancedRankings(
  models: ModelRanks[]
): Array<{ id: string; balanced_rank: number; category_balanced_rank: number }> {
  const maxRank = models.length;

  const scored = models.map((m) => {
    const w = CATEGORY_BALANCED_WEIGHTS[m.category] ?? CATEGORY_BALANCED_WEIGHTS.default;
    const capRank = m.capabilityRank ?? maxRank;
    const valRank = m.valueRank ?? maxRank;
    const rawRankPenalty = Number(m.rankPenalty ?? 0);
    const rankPenalty = Number.isFinite(rawRankPenalty)
      ? Math.max(-Math.round(maxRank * 0.25), Math.min(Math.round(maxRank * 0.75), rawRankPenalty))
      : 0;

    const composite = capRank * w.capability
                    + m.usageRank * w.usage
                    + m.expertRank * w.expert
                    + valRank * w.value
                    + rankPenalty;

    return { id: m.id, category: m.category, composite };
  });

  scored.sort((a, b) => a.composite - b.composite);

  const result = scored.map((m, i) => ({
    id: m.id,
    category: m.category,
    balanced_rank: i + 1,
    category_balanced_rank: 0,
  }));

  const groups = new Map<string, typeof result>();
  for (const m of result) {
    if (!groups.has(m.category)) groups.set(m.category, []);
    groups.get(m.category)!.push(m);
  }
  for (const group of groups.values()) {
    group.forEach((m, i) => { m.category_balanced_rank = i + 1; });
  }

  return result;
}
