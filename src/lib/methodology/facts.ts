import cronJobs from "../../../config/cron-jobs.json";
import { BENCHMARKS } from "@/lib/constants/benchmarks";
import { CATEGORIES } from "@/lib/constants/categories";
import { DATA_SOURCE_SEEDS } from "@/lib/data-sources/seed-config";
import { getBenchmarkTrackingSummary } from "@/lib/models/benchmark-status";
import { TRUSTED_STRUCTURED_BENCHMARK_SOURCES } from "@/lib/models/benchmark-score-trust";
import { countDistinctKnownModels } from "@/lib/models/known-model-meta";
import { VERIFIED_PRICING_MAX_AGE_DAYS } from "@/lib/models/pricing";
import { OFFICIAL_PROVIDERS } from "@/lib/models/public-source-trust";
import {
  DEFAULT_PUBLIC_LENS,
  PUBLIC_LENS_CONFIG,
  type PublicRankingLens,
} from "@/lib/models/public-lenses";
import { BALANCED_CATEGORY_WEIGHTS } from "@/lib/scoring/balanced-calculator";
import { CAPABILITY_LENS_WEIGHTS } from "@/lib/scoring/capability-calculator";
import {
  ADOPTION_SIGNAL_WEIGHTS,
  ECONOMIC_FOOTPRINT_WEIGHTS,
} from "@/lib/scoring/economic-footprint";
import { POPULARITY_SIGNAL_WEIGHTS } from "@/lib/scoring/popularity-score";
import { QUALITY_CATEGORY_WEIGHTS } from "@/lib/scoring/quality-calculator";

const EXAMPLE_BENCHMARK_NAMES = ["MMLU", "HellaSwag", "HumanEval"] as const;

interface CronJob {
  name: string;
  cron: string;
  path: string;
}

export interface MethodologyLens {
  value: PublicRankingLens;
  label: string;
  description: string;
  weightSummary: string;
}

export interface MethodologyEvidenceTier {
  badgeLabel: string;
  summary: string;
}

export interface MethodologyCadenceGroup {
  id: "hourly" | "two-hour" | "four-hour" | "eight-hour" | "daily";
  intervalLabel: string;
  summary: string;
  sources: string[];
}

export interface MethodologyFacts {
  lenses: MethodologyLens[];
  defaultLensLabel: string;
  overallRankSummary: string;
  evidenceTiers: MethodologyEvidenceTier[];
  qualitySummary: string;
  benchmarkCount: number;
  exampleBenchmarkNames: string[];
  trustedStructuredSourceCount: number;
  categoryCount: number;
  officialProviderCount: number;
  officialProviderNames: string[];
  knownModelCount: number;
  verifiedPricingMaxAgeDays: number;
  cadence: MethodologyCadenceGroup[];
  rankingRecompute: string;
}

function formatShare(weight: number): string {
  const percent = Math.round(weight * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

function formatPointWeight(weight: number): string {
  return Number.isInteger(weight) ? `${weight}%` : `${weight}%`;
}

function requireCronJob(path: string): CronJob {
  const job = (cronJobs as CronJob[]).find((entry) => entry.path === path);
  if (!job) {
    throw new Error(`Missing cron job for ${path}`);
  }
  return job;
}

function everyNHours(cron: string): number | null {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.trim().split(/\s+/);
  if (!minute || !hour || dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    return null;
  }
  if (!/^\d+$/.test(minute)) return null;
  if (hour === "*") return 1;
  const step = hour.match(/^\*\/(\d+)$/);
  if (step) return Number(step[1]);
  if (/^\d+$/.test(hour)) return 24;
  return null;
}

function syncSourceSlug(path: string): string | null {
  const query = path.split("?")[1];
  if (!query) return null;
  return new URLSearchParams(query).get("source");
}

function tierFromSyncPath(path: string): number | null {
  if (!path.startsWith("/api/cron/sync?")) return null;
  const tier = new URLSearchParams(path.split("?")[1] ?? "").get("tier");
  if (!tier) return null;
  const parsed = Number(tier);
  return Number.isInteger(parsed) ? parsed : null;
}

function hourlySourceSlugs(): Set<string> {
  const slugs = new Set<string>();
  for (const job of cronJobs as CronJob[]) {
    const slug = syncSourceSlug(job.path);
    if (!slug) continue;
    const interval = everyNHours(job.cron);
    if (interval === 1) slugs.add(slug);
  }
  return slugs;
}

function tierIntervalHours(): Map<number, number> {
  const intervals = new Map<number, number>();
  for (const job of cronJobs as CronJob[]) {
    const tier = tierFromSyncPath(job.path);
    if (tier == null) continue;
    const interval = everyNHours(job.cron);
    if (interval == null) {
      throw new Error(`Cannot read a refresh interval from ${job.cron} (${job.path})`);
    }
    intervals.set(tier, interval);
  }
  return intervals;
}

function lensWeightSummary(lens: PublicRankingLens): string {
  switch (lens) {
    case "capability":
      return `Benchmarks ${formatShare(CAPABILITY_LENS_WEIGHTS.benchmarks)}, arena Elo ${formatShare(CAPABILITY_LENS_WEIGHTS.elo)}, recency ${formatShare(CAPABILITY_LENS_WEIGHTS.recency)}. If benchmarks or Elo are missing, the other signal absorbs that weight. Models with neither stay unranked. Arena-only scores are discounted, with a smaller discount for image generation.`;
    case "popularity":
      return `Community downloads, likes, and stars ${formatShare(POPULARITY_SIGNAL_WEIGHTS.community)}, news and trending ${formatShare(POPULARITY_SIGNAL_WEIGHTS.market)}, provider usage ${formatShare(POPULARITY_SIGNAL_WEIGHTS.adoption)}, durability ${formatShare(POPULARITY_SIGNAL_WEIGHTS.durability)}. Missing signals are dropped and the rest are rescaled.`;
    case "adoption":
      return `Downloads ${formatShare(ADOPTION_SIGNAL_WEIGHTS.downloads)}, provider usage ${formatShare(ADOPTION_SIGNAL_WEIGHTS.usage)}, distribution across priced routes and API availability ${formatShare(ADOPTION_SIGNAL_WEIGHTS.distribution)}, durability ${formatShare(ADOPTION_SIGNAL_WEIGHTS.durability)}.`;
    case "economic":
      return `Adoption ${formatShare(ECONOMIC_FOOTPRINT_WEIGHTS.adoption)}, monetization from verified price ${formatShare(ECONOMIC_FOOTPRINT_WEIGHTS.monetization)}, distribution ${formatShare(ECONOMIC_FOOTPRINT_WEIGHTS.distribution)}, durability ${formatShare(ECONOMIC_FOOTPRINT_WEIGHTS.durability)}, then multiplied by an evidence confidence factor. Missing benchmark, arena, or pricing evidence lowers that factor.`;
    case "value":
      return `Quality divided by a positive verified input price no older than ${VERIFIED_PRICING_MAX_AGE_DAYS} days, then log-normalized to 0–100. A missing or non-positive price leaves the model unranked. It is not treated as free. Open-weight models can still show a Free access label when no API price is published; that label is not a Value score.`;
    default: {
      const unexpected: never = lens;
      return unexpected;
    }
  }
}

function evidenceTiers(): MethodologyEvidenceTier[] {
  const base = {
    slug: "example-model",
    provider: "OpenAI",
    category: "llm",
    trustedBenchmarkScoreCount: 0,
    benchmarkEvidenceCount: 0,
    arenaSignalCount: 0,
  };
  const summaries = [
    getBenchmarkTrackingSummary({ ...base, trustedBenchmarkScoreCount: 1 }),
    getBenchmarkTrackingSummary({ ...base, benchmarkEvidenceCount: 1 }),
    getBenchmarkTrackingSummary({ ...base, arenaSignalCount: 1 }),
    getBenchmarkTrackingSummary(base),
    getBenchmarkTrackingSummary({
      ...base,
      slug: "example-video",
      provider: "Example Studio",
      category: "video",
    }),
  ];

  return summaries.map((summary) => ({
    badgeLabel: summary.badgeLabel,
    summary: summary.summary,
  }));
}

function cadenceIdForSeed(
  slug: string,
  intervalHours: number,
  hourlySlugs: Set<string>
): MethodologyCadenceGroup["id"] {
  if (hourlySlugs.has(slug)) return "hourly";

  switch (intervalHours) {
    case 2:
      return "two-hour";
    case 4:
      return "four-hour";
    case 8:
      return "eight-hour";
    case 24:
      return "daily";
    default:
      throw new Error(`${slug} uses an unexpected ${intervalHours}h interval`);
  }
}

function cadenceGroups(): MethodologyCadenceGroup[] {
  const intervals = tierIntervalHours();
  const hourly = hourlySourceSlugs();
  const groups = new Map<MethodologyCadenceGroup["id"], string[]>();

  for (const seed of DATA_SOURCE_SEEDS) {
    if (!seed.is_enabled) continue;
    const tierInterval = intervals.get(seed.tier);
    if (tierInterval == null) {
      throw new Error(`No sync cron is configured for tier ${seed.tier}`);
    }
    if (seed.sync_interval_hours !== tierInterval) {
      throw new Error(
        `${seed.slug} is seeded at ${seed.sync_interval_hours}h but tier ${seed.tier} runs every ${tierInterval}h`
      );
    }

    const id = cadenceIdForSeed(seed.slug, seed.sync_interval_hours, hourly);
    const names = groups.get(id) ?? [];
    names.push(seed.name);
    groups.set(id, names);
  }

  const ordered: Array<Pick<MethodologyCadenceGroup, "id" | "intervalLabel" | "summary">> = [
    {
      id: "hourly",
      intervalLabel: "About every hour",
      summary:
        "Launch feeds. These sources also belong to the two-hour tier, and a dedicated job polls them every hour.",
    },
    {
      id: "two-hour",
      intervalLabel: "About every 2 hours",
      summary: "High-priority provider catalogs.",
    },
    {
      id: "four-hour",
      intervalLabel: "About every 4 hours",
      summary:
        "Secondary catalogs, official pricing, community distribution, core benchmarks, and arena ratings.",
    },
    {
      id: "eight-hour",
      intervalLabel: "About every 8 hours",
      summary: "Slower benchmark leaderboards, papers, GitHub signals, and deployment pricing.",
    },
    {
      id: "daily",
      intervalLabel: "Daily",
      summary: "Lower-priority research metadata and agent benchmarks.",
    },
  ];

  return ordered
    .filter((group) => (groups.get(group.id) ?? []).length > 0)
    .map((group) => ({
      ...group,
      sources: [...(groups.get(group.id) ?? [])].sort((left, right) =>
        left.localeCompare(right)
      ),
    }));
}

function rankingRecomputeLabel(): string {
  const job = requireCronJob("/api/cron/compute-scores");
  const hours = everyNHours(job.cron);
  if (hours == null) {
    throw new Error(`Cannot read the score recompute cadence from ${job.cron}`);
  }
  return hours === 1
    ? "Rankings recompute about every hour."
    : `Rankings recompute about every ${hours} hours.`;
}

function qualitySummary(exampleNames: string[]): string {
  const weights = QUALITY_CATEGORY_WEIGHTS.llm;
  const examples =
    exampleNames.length > 0 ? `, including ${exampleNames.join(", ")}` : "";
  return `The Quality Score is a 0–100 composite of the signals available for a model's category. Large language models start at benchmarks ${formatPointWeight(weights.benchmarks)}, arena Elo ${formatPointWeight(weights.elo)}, downloads ${formatPointWeight(weights.popularity)}, community likes ${formatPointWeight(weights.community)}, recency ${formatPointWeight(weights.recency)}, and open weights ${formatPointWeight(weights.openness)}. Missing signals are dropped and the rest are rescaled. Models with neither benchmarks nor arena Elo are capped. A higher score means stronger coverage across the evaluations we ingest${examples}. It is not a guarantee on every task.`;
}

function overallRankSummary(): string {
  const weights = BALANCED_CATEGORY_WEIGHTS.llm;
  return `Some tables show an overall rank for browsing. That rank blends capability, usage, expert consensus, and value, then applies an evidence penalty. For large language models the starting mix is capability ${formatShare(weights.capability)}, usage ${formatShare(weights.usage)}, expert consensus ${formatShare(weights.expert)}, and value ${formatShare(weights.value)}. Usage and expert consensus are internal signals, not extra public lenses. A selected lens sorts by that lens.`;
}

export function getMethodologyFacts(): MethodologyFacts {
  const exampleBenchmarkNames = EXAMPLE_BENCHMARK_NAMES.filter((name) =>
    BENCHMARKS.some((benchmark) => benchmark.name === name)
  );
  const defaultLens = PUBLIC_LENS_CONFIG.find((lens) => lens.value === DEFAULT_PUBLIC_LENS);

  return {
    lenses: PUBLIC_LENS_CONFIG.map((lens) => ({
      value: lens.value,
      label: lens.label,
      description: lens.description,
      weightSummary: lensWeightSummary(lens.value),
    })),
    defaultLensLabel: defaultLens?.label ?? "Economic Footprint",
    overallRankSummary: overallRankSummary(),
    evidenceTiers: evidenceTiers(),
    qualitySummary: qualitySummary(exampleBenchmarkNames),
    benchmarkCount: BENCHMARKS.length,
    exampleBenchmarkNames,
    trustedStructuredSourceCount: TRUSTED_STRUCTURED_BENCHMARK_SOURCES.size,
    categoryCount: CATEGORIES.length,
    officialProviderCount: OFFICIAL_PROVIDERS.size,
    officialProviderNames: [...OFFICIAL_PROVIDERS].sort((left, right) =>
      left.localeCompare(right)
    ),
    knownModelCount: countDistinctKnownModels(),
    verifiedPricingMaxAgeDays: VERIFIED_PRICING_MAX_AGE_DAYS,
    cadence: cadenceGroups(),
    rankingRecompute: rankingRecomputeLabel(),
  };
}
