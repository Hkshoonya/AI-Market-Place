export interface ArenaRatingLike {
  arena_name: string;
  elo_score: number;
  rank?: number | null;
  confidence_interval_low?: number | null;
  confidence_interval_high?: number | null;
  num_battles?: number | null;
  snapshot_date?: string | null;
  created_at?: string | null;
}

export type CollapsedArenaRating<T extends ArenaRatingLike = ArenaRatingLike> = T & {
  familyKey: string;
  displayName: string;
  rawArenaNames: string[];
  variantCount: number;
  variants: T[];
};

const ARENA_FAMILY_ALIASES = new Map<string, { familyKey: string; displayName: string }>([
  ["chatbot-arena", { familyKey: "chatbot-arena", displayName: "Chatbot Arena" }],
  ["chatbot arena", { familyKey: "chatbot-arena", displayName: "Chatbot Arena" }],
  ["lmarena", { familyKey: "chatbot-arena", displayName: "Chatbot Arena" }],
  ["lm arena", { familyKey: "chatbot-arena", displayName: "Chatbot Arena" }],
  ["vision-arena", { familyKey: "vision-arena", displayName: "Vision Arena" }],
  ["vision arena", { familyKey: "vision-arena", displayName: "Vision Arena" }],
  ["arena-hard-auto", { familyKey: "arena-hard-auto", displayName: "Arena-Hard Auto" }],
  ["arena hard auto", { familyKey: "arena-hard-auto", displayName: "Arena-Hard Auto" }],
]);

function normalizeArenaName(rawArenaName: string): string {
  return rawArenaName
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function titleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function canonicalizeArenaFamily(rawArenaName: string): {
  familyKey: string;
  displayName: string;
} {
  const normalized = normalizeArenaName(rawArenaName);
  const known = ARENA_FAMILY_ALIASES.get(normalized);
  if (known) return known;

  return {
    familyKey: normalized.replace(/\s+/g, "-"),
    displayName: titleCaseWords(normalized),
  };
}

function arenaTimestampScore(rating: ArenaRatingLike): number {
  const timestamp = rating.snapshot_date ?? rating.created_at ?? null;
  if (!timestamp) return 0;
  const value = Date.parse(timestamp);
  return Number.isFinite(value) ? value : 0;
}

function compareArenaRatings(a: ArenaRatingLike, b: ArenaRatingLike): number {
  const timestampDiff = arenaTimestampScore(b) - arenaTimestampScore(a);
  if (timestampDiff !== 0) return timestampDiff;

  const battleDiff = (b.num_battles ?? 0) - (a.num_battles ?? 0);
  if (battleDiff !== 0) return battleDiff;

  return (b.elo_score ?? 0) - (a.elo_score ?? 0);
}

export function collapseArenaRatings<T extends ArenaRatingLike>(
  ratings: T[]
): Array<CollapsedArenaRating<T>> {
  const families = new Map<string, { displayName: string; rows: T[] }>();

  for (const rating of ratings) {
    const { familyKey, displayName } = canonicalizeArenaFamily(rating.arena_name);
    const existing = families.get(familyKey) ?? { displayName, rows: [] as T[] };
    existing.rows.push(rating);
    families.set(familyKey, existing);
  }

  return Array.from(families.entries())
    .map(([familyKey, family]) => {
      const variants = family.rows.toSorted(compareArenaRatings);
      const primary = variants[0];

      return {
        ...primary,
        familyKey,
        displayName: family.displayName,
        rawArenaNames: Array.from(new Set(variants.map((variant) => variant.arena_name))).sort(),
        variantCount: variants.length,
        variants,
      };
    })
    .toSorted(compareArenaRatings);
}
