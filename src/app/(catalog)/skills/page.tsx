import Link from "next/link";
import {
  BookOpen,
  Bot,
  Brain,
  Calculator,
  Code,
  Crown,
  ExternalLink,
  Globe,
  Languages,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { formatNumber } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Skills & Capabilities | AI Market Cap",
  description:
    "Discover which AI models excel at coding, reasoning, math, browser automation, and more.",
};

export const revalidate = 1800;

// ---------------------------------------------------------------------------
// Skill category definitions
// ---------------------------------------------------------------------------

interface SkillDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  benchmarkSlugs: string[];
  weight: number;
}

const SKILLS: SkillDef[] = [
  {
    id: "coding",
    name: "Coding & Development",
    description: "Code generation, debugging, and software engineering",
    icon: Code,
    color: "#22d3ee",
    benchmarkSlugs: [
      "humaneval",
      "swe_bench",
      "swe-bench",
      "livebench-coding",
      "livebench_coding",
    ],
    weight: 0.3,
  },
  {
    id: "reasoning",
    name: "Reasoning & Logic",
    description: "Complex reasoning, problem solving, and critical thinking",
    icon: Brain,
    color: "#a78bfa",
    benchmarkSlugs: ["gpqa", "arc-challenge", "arc", "livebench-reasoning"],
    weight: 0.15,
  },
  {
    id: "math",
    name: "Mathematics",
    description: "Mathematical problem solving and computation",
    icon: Calculator,
    color: "#f59e0b",
    benchmarkSlugs: ["math-benchmark", "math", "livebench-math", "gsm8k"],
    weight: 0.1,
  },
  {
    id: "browser_automation",
    name: "Browser Automation",
    description: "Web browsing, form filling, and browser-based tasks",
    icon: Globe,
    color: "#6366f1",
    benchmarkSlugs: ["webarena", "web-arena"],
    weight: 0.1,
  },
  {
    id: "language",
    name: "Language & Writing",
    description: "Text generation, translation, and communication",
    icon: Languages,
    color: "#ec4899",
    benchmarkSlugs: ["mmlu", "mmlu-pro", "livebench-language"],
    weight: 0.1,
  },
  {
    id: "agent_tasks",
    name: "Agent & Tool Use",
    description: "Autonomous task execution and tool orchestration",
    icon: Bot,
    color: "#10b981",
    benchmarkSlugs: ["gaia", "tau-bench", "terminal-bench", "os-world"],
    weight: 0.15,
  },
  {
    id: "knowledge",
    name: "Knowledge & QA",
    description: "Factual knowledge retrieval and question answering",
    icon: BookOpen,
    color: "#f97316",
    benchmarkSlugs: ["mmlu", "mmlu-pro", "triviaqa"],
    weight: 0.1,
  },
];

// ---------------------------------------------------------------------------
// Types for processed data
// ---------------------------------------------------------------------------

interface ModelScoreEntry {
  modelId: string;
  slug: string;
  name: string;
  provider: string;
  marketCap: number | null;
  isOpenWeights: boolean;
  avgScore: number;
  scoreCount: number;
}

interface AffiliatePlatform {
  id: string;
  slug: string;
  name: string;
  affiliate_url_template: string | null;
  has_affiliate: boolean;
  base_url: string;
}

interface DeploymentRow {
  model_id: string;
  deploy_url: string | null;
  platform_id: string;
  deployment_platforms: AffiliatePlatform | null;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function SkillsPage() {
  const supabase = await createClient();

  // Fetch benchmark scores with model + benchmark info
  const BenchmarkScoreEntrySchema = z.object({
    score: z.number().nullable(),
    score_normalized: z.number().nullable(),
    model_id: z.string(),
    models: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      provider: z.string(),
      category: z.string(),
      quality_score: z.number().nullable(),
      market_cap_estimate: z.number().nullable(),
      is_open_weights: z.boolean(),
    }).nullable(),
    benchmarks: z.object({
      slug: z.string(),
      name: z.string(),
    }).nullable(),
  });

  const benchmarkDataResponse = await supabase
    .from("benchmark_scores")
    .select(
      "score, score_normalized, model_id, models!inner(id, slug, name, provider, category, quality_score, market_cap_estimate, is_open_weights), benchmarks!inner(slug, name)"
    )
    .eq("models.status" as never, "active")
    .order("score", { ascending: false })
    .limit(2000);

  const benchmarkData = parseQueryResult(benchmarkDataResponse, BenchmarkScoreEntrySchema, "SkillsBenchmarkScore");

  // Fetch affiliate deployment platforms
  const AffiliatePlatformSchema = z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    affiliate_url_template: z.string().nullable(),
    has_affiliate: z.boolean(),
    base_url: z.string(),
  });

  const platformsResponse = await supabase
    .from("deployment_platforms")
    .select("*")
    .eq("has_affiliate", true);

  const affiliatePlatforms = parseQueryResult(platformsResponse, AffiliatePlatformSchema, "AffiliatePlatform");

  // Fetch model deployments that link to affiliate platforms
  const affiliatePlatformIds = affiliatePlatforms.map((p) => p.id);
  const DeploymentRowSchema = z.object({
    model_id: z.string(),
    deploy_url: z.string().nullable(),
    platform_id: z.string(),
    deployment_platforms: AffiliatePlatformSchema.nullable(),
  });

  let deployments: z.infer<typeof DeploymentRowSchema>[] = [];
  if (affiliatePlatformIds.length > 0) {
    const deploymentsResponse = await supabase
      .from("model_deployments")
      .select("model_id, deploy_url, platform_id, deployment_platforms(*)")
      .in("platform_id", affiliatePlatformIds);

    deployments = parseQueryResult(deploymentsResponse, DeploymentRowSchema, "DeploymentRow");
  }

  // Build a map: model_id -> affiliate deploy info
  const affiliateMap = new Map<
    string,
    { url: string; platformName: string }
  >();
  for (const dep of deployments) {
    const platform = dep.deployment_platforms;
    if (!platform) continue;
    const template: string | null = platform.affiliate_url_template;
    const deployUrl: string | null = dep.deploy_url;
    const finalUrl = template ?? deployUrl ?? platform.base_url;
    if (finalUrl) {
      const separator = finalUrl.includes("?") ? "&" : "?";
      affiliateMap.set(dep.model_id, {
        url: `${finalUrl}${separator}ref=aimarketcap&utm_source=aimarketcap&utm_medium=skills_page`,
        platformName: platform.name,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Process: for each skill, compute ranked models by avg benchmark score
  // ---------------------------------------------------------------------------

  function computeSkillRanking(skill: SkillDef): ModelScoreEntry[] {
    // Collect scores per model for this skill's benchmarks
    const modelScores = new Map<
      string,
      {
        slug: string;
        name: string;
        provider: string;
        marketCap: number | null;
        isOpenWeights: boolean;
        scores: number[];
      }
    >();

    for (const entry of benchmarkData) {
      const benchmark = entry.benchmarks;
      const model = entry.models;
      if (!benchmark || !model) continue;

      const benchSlug: string = benchmark.slug;
      if (!skill.benchmarkSlugs.includes(benchSlug)) continue;

      const score =
        entry.score_normalized != null
          ? Number(entry.score_normalized)
          : entry.score != null
            ? Number(entry.score)
            : null;
      if (score == null) continue;

      const existing = modelScores.get(model.id);
      if (existing) {
        existing.scores.push(score);
      } else {
        modelScores.set(model.id, {
          slug: model.slug,
          name: model.name,
          provider: model.provider,
          marketCap: model.market_cap_estimate
            ? Number(model.market_cap_estimate)
            : null,
          isOpenWeights: !!model.is_open_weights,
          scores: [score],
        });
      }
    }

    // Compute average and sort
    const ranked: ModelScoreEntry[] = [];
    for (const [modelId, data] of modelScores.entries()) {
      const avg =
        data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length;
      ranked.push({
        modelId,
        slug: data.slug,
        name: data.name,
        provider: data.provider,
        marketCap: data.marketCap,
        isOpenWeights: data.isOpenWeights,
        avgScore: avg,
        scoreCount: data.scores.length,
      });
    }

    ranked.sort((a, b) => b.avgScore - a.avgScore);
    return ranked;
  }

  // Pre-compute rankings for all skills
  const skillRankings = new Map<string, ModelScoreEntry[]>();
  for (const skill of SKILLS) {
    skillRankings.set(skill.id, computeSkillRanking(skill));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Skills &amp; Capabilities</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Discover which AI models excel at specific skills. Rankings based on
          benchmark performance and real-world capability.
        </p>
      </div>

      {/* Skills Grid */}
      <div className="mb-12 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {SKILLS.map((skill) => {
          const ranked = skillRankings.get(skill.id) ?? [];
          const top3 = ranked.slice(0, 3);
          const Icon = skill.icon;

          return (
            <a
              key={skill.id}
              href={`#skill-${skill.id}`}
              className="group rounded-xl border border-border/50 bg-secondary/20 p-5 transition-all hover:border-neon/30 hover:bg-secondary/30"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${skill.color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color: skill.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold group-hover:text-neon transition-colors">
                    {skill.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {skill.description}
                  </p>
                </div>
              </div>

              {/* Top 3 preview */}
              {top3.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {top3.map((entry, i) => (
                    <div
                      key={entry.modelId}
                      className="flex items-center gap-2"
                    >
                      <span
                        className={`w-5 text-xs font-bold tabular-nums ${
                          i === 0
                            ? "text-neon"
                            : "text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <ProviderLogo provider={entry.provider} size="sm" />
                      <span className="flex-1 truncate text-xs font-medium">
                        {entry.name}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {entry.avgScore.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground/60 italic">
                  No benchmark data yet
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <Badge
                  variant="outline"
                  className="border-transparent text-[10px]"
                  style={{
                    backgroundColor: `${skill.color}15`,
                    color: skill.color,
                  }}
                >
                  Weight: {(skill.weight * 100).toFixed(0)}%
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {ranked.length} model{ranked.length !== 1 ? "s" : ""}
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* Detailed Skill Rankings */}
      <div className="space-y-12">
        {SKILLS.map((skill) => {
          const ranked = skillRankings.get(skill.id) ?? [];
          const top10 = ranked.slice(0, 10);
          const Icon = skill.icon;

          return (
            <section key={skill.id} id={`skill-${skill.id}`}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${skill.color}15` }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: skill.color }}
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{skill.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {skill.description} &middot; Top models ranked by average
                    benchmark score
                  </p>
                </div>
              </div>

              {top10.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-border/50">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30">
                        <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                          Model
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          Avg Score
                        </th>
                        <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">
                          Benchmarks
                        </th>
                        <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                          Market Cap
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                          Try It
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {top10.map((entry, i) => {
                        const rank = i + 1;
                        const affiliate = affiliateMap.get(entry.modelId);

                        return (
                          <tr
                            key={entry.modelId}
                            className="border-b border-border/30 table-row-hover"
                          >
                            {/* Rank */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-1">
                                {rank <= 3 && (
                                  <Crown
                                    className={`h-3.5 w-3.5 ${
                                      rank === 1
                                        ? "text-[#FFD700]"
                                        : rank === 2
                                          ? "text-[#C0C0C0]"
                                          : "text-[#CD7F32]"
                                    }`}
                                  />
                                )}
                                <span
                                  className={`text-sm font-bold tabular-nums ${
                                    rank <= 3
                                      ? "text-neon"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {rank}
                                </span>
                              </div>
                            </td>

                            {/* Model */}
                            <td className="px-4 py-3.5">
                              <Link href={`/models/${entry.slug}`}>
                                <div className="flex items-center gap-2">
                                  <ProviderLogo
                                    provider={entry.provider}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    <span className="text-sm font-semibold hover:text-neon transition-colors line-clamp-1">
                                      {entry.name}
                                    </span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      {entry.provider}
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            </td>

                            {/* Avg Score */}
                            <td className="px-4 py-3.5 text-right">
                              <span
                                className="text-sm font-bold tabular-nums"
                                style={{ color: skill.color }}
                              >
                                {entry.avgScore.toFixed(1)}
                              </span>
                            </td>

                            {/* Benchmark count */}
                            <td className="hidden px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                              {entry.scoreCount}
                            </td>

                            {/* Market Cap */}
                            <td className="hidden px-4 py-3.5 text-right md:table-cell">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {entry.marketCap
                                  ? entry.marketCap >= 1_000_000
                                    ? `$${(entry.marketCap / 1_000_000).toFixed(1)}M`
                                    : `$${(entry.marketCap / 1_000).toFixed(0)}K`
                                  : "---"}
                              </span>
                            </td>

                            {/* Try It / View */}
                            <td className="px-4 py-3.5 text-right">
                              {affiliate ? (
                                <a
                                  href={affiliate.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-gain/10 px-2.5 py-1 text-xs font-semibold text-gain transition-colors hover:bg-gain/20"
                                >
                                  Try It
                                  <ExternalLink className="h-3 w-3" />
                                  <Badge
                                    variant="outline"
                                    className="ml-1 border-yellow-500/30 bg-yellow-500/10 text-[9px] text-yellow-500 px-1 py-0"
                                  >
                                    Partner
                                  </Badge>
                                </a>
                              ) : (
                                <Link
                                  href={`/models/${entry.slug}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-secondary/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                >
                                  View
                                  <ExternalLink className="h-3 w-3" />
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-border/30 py-12 text-center">
                  <Icon className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No benchmark data available for this skill yet.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    Scores will appear once benchmarks are ingested.
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Marketplace CTA */}
      <section className="mt-16 rounded-xl border border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5 p-8 text-center">
        <h2 className="text-xl font-bold">
          Need a model for a specific skill?
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Browse the marketplace for fine-tuned models, API access, and
          specialized solutions tailored to your use case.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-lg bg-neon px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-neon/90"
          >
            Browse Marketplace
            <ExternalLink className="h-4 w-4" />
          </Link>
          <Link
            href="/leaderboards"
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-5 py-2.5 text-sm font-medium transition-colors hover:border-neon/30 hover:text-neon"
          >
            Full Leaderboards
          </Link>
        </div>
      </section>
    </div>
  );
}
