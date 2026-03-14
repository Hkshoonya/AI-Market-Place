import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  CATEGORIES,
  CATEGORY_MAP,
  type ModelCategory,
} from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { CategoryModelSchema } from "@/lib/schemas/rankings";
import { getParameterDisplay } from "@/lib/models/presentation";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { Metadata } from "next";
import type { z } from "zod";

export const revalidate = 3600;

export async function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const categoryConfig = CATEGORY_MAP[category as ModelCategory];
  if (!categoryConfig) return { title: "Category Not Found" };

  return {
    title: `${categoryConfig.label} Leaderboard`,
    description: `Rankings of the best ${categoryConfig.label.toLowerCase()} AI models by capability, speed, and value.`,
  };
}

export default async function CategoryLeaderboardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryConfig = CATEGORY_MAP[category as ModelCategory];

  if (!categoryConfig) {
    notFound();
  }

  const supabase = createPublicClient();

  const modelsResponse = await supabase
    .from("models")
    .select("*, benchmark_scores(*, benchmarks(*)), model_pricing(*), rankings(*)")
    .eq("status", "active")
    .eq("category", category as import("@/types/database").ModelCategory)
    .order("capability_score", { ascending: false, nullsFirst: false });

  type CategoryModel = z.infer<typeof CategoryModelSchema>;
  const models = parseQueryResult(
    modelsResponse,
    CategoryModelSchema,
    "CategoryModel"
  );

  const isBrowserCategory = category === "agentic_browser";
  const primaryMetricLabel = isBrowserCategory ? "Browser Score" : "Capability";

  const sortedModels = [...models].sort((left, right) => {
    const leftPrimary =
      (isBrowserCategory ? left.agent_score : null) ??
      left.capability_score ??
      left.quality_score ??
      Number.NEGATIVE_INFINITY;
    const rightPrimary =
      (isBrowserCategory ? right.agent_score : null) ??
      right.capability_score ??
      right.quality_score ??
      Number.NEGATIVE_INFINITY;

    if (rightPrimary !== leftPrimary) return rightPrimary - leftPrimary;

    const leftSecondary =
      left.quality_score ?? left.capability_score ?? Number.NEGATIVE_INFINITY;
    const rightSecondary =
      right.quality_score ?? right.capability_score ?? Number.NEGATIVE_INFINITY;

    if (rightSecondary !== leftSecondary) return rightSecondary - leftSecondary;

    return (
      (left.category_rank ?? left.overall_rank ?? Number.MAX_SAFE_INTEGER) -
      (right.category_rank ?? right.overall_rank ?? Number.MAX_SAFE_INTEGER)
    );
  });

  const benchmarkMap = new Map<string, { name: string; slug: string }>();
  for (const model of sortedModels) {
    for (const benchmarkScore of model.benchmark_scores ?? []) {
      const benchmark = benchmarkScore.benchmarks;
      if (benchmark && !benchmarkMap.has(benchmark.slug)) {
        benchmarkMap.set(benchmark.slug, {
          name: benchmark.name,
          slug: benchmark.slug,
        });
      }
    }
  }
  const benchmarks = Array.from(benchmarkMap.values());

  function getBenchmarkScore(
    model: CategoryModel,
    benchmarkSlug: string
  ): number | null {
    const scores = model.benchmark_scores ?? [];
    const match = scores.find((score) => score.benchmarks?.slug === benchmarkSlug);
    return match ? Number(match.score_normalized) : null;
  }

  function getCheapestInput(model: CategoryModel): number | null {
    const pricing = model.model_pricing ?? [];
    const prices = pricing
      .map((entry) => Number(entry.input_price_per_million))
      .filter((price) => !Number.isNaN(price) && price > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  function getBestSpeed(model: CategoryModel): number | null {
    const pricing = model.model_pricing ?? [];
    const speeds = pricing
      .map((entry) => Number(entry.median_output_tokens_per_second))
      .filter((speed) => !Number.isNaN(speed) && speed > 0);
    return speeds.length > 0 ? Math.max(...speeds) : null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/leaderboards"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Leaderboards
      </Link>

      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${categoryConfig.color}15` }}
        >
          <categoryConfig.icon
            className="h-6 w-6"
            style={{ color: categoryConfig.color }}
          />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{categoryConfig.label} Leaderboard</h1>
          <p className="text-muted-foreground">{categoryConfig.description}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{sortedModels.length}</p>
            <p className="text-xs text-muted-foreground">Models</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{benchmarks.length}</p>
            <p className="text-xs text-muted-foreground">Benchmarks</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {new Set(sortedModels.map((model) => model.provider)).size}
            </p>
            <p className="text-xs text-muted-foreground">Providers</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {sortedModels.filter((model) => model.is_open_weights).length}
            </p>
            <p className="text-xs text-muted-foreground">Open Weight</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((categoryTab) => (
          <Link key={categoryTab.slug} href={`/leaderboards/${categoryTab.slug}`}>
            <Badge
              variant="outline"
              className={`gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                categoryTab.slug === category
                  ? "border-transparent font-bold"
                  : "border-border/50 text-muted-foreground hover:bg-secondary"
              }`}
              style={
                categoryTab.slug === category
                  ? {
                      backgroundColor: `${categoryTab.color}20`,
                      color: categoryTab.color,
                    }
                  : undefined
              }
            >
              <categoryTab.icon className="h-3.5 w-3.5" />
              {categoryTab.shortLabel}
            </Badge>
          </Link>
        ))}
      </div>

      {sortedModels.length > 0 ? (
        <Card className="mt-8 overflow-hidden border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/20">
                    <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Model
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      {primaryMetricLabel}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Quality
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Params
                    </th>
                    {benchmarks.slice(0, 4).map((benchmark) => (
                      <th
                        key={benchmark.slug}
                        className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell"
                      >
                        {benchmark.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      $/M In
                    </th>
                    <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground sm:table-cell">
                      Speed
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Open
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedModels.map((model, index) => {
                    const price = getCheapestInput(model);
                    const speed = getBestSpeed(model);
                    const parameterDisplay = getParameterDisplay(model);
                    const primaryMetric =
                      (isBrowserCategory ? model.agent_score : null) ??
                      model.capability_score ??
                      model.quality_score;

                    return (
                      <tr
                        key={model.id}
                        className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            {index < 3 && (
                              <Trophy
                                className="h-3.5 w-3.5"
                                style={{ color: categoryConfig.color }}
                              />
                            )}
                            <span
                              className={`font-bold ${
                                index < 3 ? "" : "text-muted-foreground"
                              }`}
                              style={
                                index < 3 ? { color: categoryConfig.color } : undefined
                              }
                            >
                              {model.category_rank ?? index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/models/${model.slug}`}
                            className="transition-colors hover:text-neon"
                          >
                            <div className="flex items-center gap-2">
                              <ProviderLogo provider={model.provider} size="sm" />
                              <div>
                                <p className="text-sm font-semibold">{model.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {model.provider}
                                </p>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold tabular-nums text-neon">
                            {primaryMetric != null ? Number(primaryMetric).toFixed(1) : "â€”"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {model.quality_score != null
                              ? Number(model.quality_score).toFixed(1)
                              : "â€”"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                          {parameterDisplay.label}
                        </td>
                        {benchmarks.slice(0, 4).map((benchmark) => {
                          const score = getBenchmarkScore(model, benchmark.slug);
                          return (
                            <td
                              key={benchmark.slug}
                              className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell"
                            >
                              {score !== null ? score.toFixed(1) : "â€”"}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-right text-sm tabular-nums">
                          {price !== null ? (
                            <span>${price.toFixed(2)}</span>
                          ) : (
                            <span className="text-gain">Free</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
                          {speed !== null ? `${speed.toFixed(0)} tok/s` : "â€”"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {model.is_open_weights ? (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gain" />
                          ) : (
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            No models found in this category yet.
          </p>
        </div>
      )}
    </div>
  );
}
