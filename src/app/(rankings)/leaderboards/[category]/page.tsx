import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES, CATEGORY_MAP, type ModelCategory } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/server";
import { parseQueryResult } from "@/lib/schemas/parse";
import { CategoryModelSchema } from "@/lib/schemas/rankings";
import type { z } from "zod";
import { formatParams, formatTokenPrice, formatNumber } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { Metadata } from "next";

export const revalidate = 3600;

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORY_MAP[category as ModelCategory];
  if (!cat) return { title: "Category Not Found" };

  return {
    title: `${cat.label} Leaderboard`,
    description: `Rankings of the best ${cat.label.toLowerCase()} AI models by quality, speed, and value.`,
  };
}



export default async function CategoryLeaderboardPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = CATEGORY_MAP[category as ModelCategory];

  if (!cat) {
    notFound();
  }

  const supabase = await createClient();

  // Fetch models in this category with their benchmark scores and pricing
  const modelsResponse = await supabase
    .from("models")
    .select("*, benchmark_scores(*, benchmarks(*)), model_pricing(*), rankings(*)")
    .eq("status", "active")
    .eq("category", category as import("@/types/database").ModelCategory)
    .order("quality_score", { ascending: false, nullsFirst: false });

  type CategoryModel = z.infer<typeof CategoryModelSchema>;
  const models = parseQueryResult(modelsResponse, CategoryModelSchema, "CategoryModel");

  // Collect all benchmarks that appear in this category
  const benchmarkMap = new Map<string, { name: string; slug: string }>();
  for (const m of models) {
    for (const bs of m.benchmark_scores ?? []) {
      const bm = bs.benchmarks;
      if (bm && !benchmarkMap.has(bm.slug)) {
        benchmarkMap.set(bm.slug, { name: bm.name, slug: bm.slug });
      }
    }
  }
  const benchmarks = Array.from(benchmarkMap.values());

  function getBenchmarkScore(model: CategoryModel, benchSlug: string): number | null {
    const scores = model.benchmark_scores ?? [];
    const match = scores.find((s) => s.benchmarks?.slug === benchSlug);
    return match ? Number(match.score_normalized) : null;
  }

  function getCheapestInput(model: CategoryModel): number | null {
    const pricing = model.model_pricing ?? [];
    const prices = pricing
      .map((p) => Number(p.input_price_per_million))
      .filter((p) => !isNaN(p) && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  function getBestSpeed(model: CategoryModel): number | null {
    const pricing = model.model_pricing ?? [];
    const speeds = pricing
      .map((p) => Number(p.median_output_tokens_per_second))
      .filter((s) => !isNaN(s) && s > 0);
    return speeds.length > 0 ? Math.max(...speeds) : null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/leaderboards"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Leaderboards
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${cat.color}15` }}
        >
          <cat.icon className="h-6 w-6" style={{ color: cat.color }} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{cat.label} Leaderboard</h1>
          <p className="text-muted-foreground">{cat.description}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{models.length}</p>
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
              {new Set(models.map((m) => m.provider)).size}
            </p>
            <p className="text-xs text-muted-foreground">Providers</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {models.filter((m) => m.is_open_weights).length}
            </p>
            <p className="text-xs text-muted-foreground">Open Weight</p>
          </CardContent>
        </Card>
      </div>

      {/* Category navigation */}
      <div className="mt-8 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/leaderboards/${c.slug}`}>
            <Badge
              variant="outline"
              className={`gap-1.5 px-3 py-1.5 text-xs transition-colors ${
                c.slug === category
                  ? "border-transparent font-bold"
                  : "border-border/50 text-muted-foreground hover:bg-secondary"
              }`}
              style={
                c.slug === category
                  ? { backgroundColor: `${c.color}20`, color: c.color }
                  : undefined
              }
            >
              <c.icon className="h-3.5 w-3.5" />
              {c.shortLabel}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Leaderboard table */}
      {models.length > 0 ? (
        <Card className="mt-8 border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/20">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                      Model
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Quality
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                      Params
                    </th>
                    {benchmarks.slice(0, 4).map((bm) => (
                      <th
                        key={bm.slug}
                        className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell"
                      >
                        {bm.name}
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
                  {models.map((model, i: number) => {
                    const price = getCheapestInput(model);
                    const speed = getBestSpeed(model);
                    return (
                      <tr
                        key={model.id}
                        className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            {i < 3 && (
                              <Trophy
                                className="h-3.5 w-3.5"
                                style={{ color: cat.color }}
                              />
                            )}
                            <span
                              className={`font-bold ${i < 3 ? "" : "text-muted-foreground"}`}
                              style={i < 3 ? { color: cat.color } : undefined}
                            >
                              {i + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/models/${model.slug}`}
                            className="hover:text-neon transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ProviderLogo provider={model.provider} size="sm" />
                              <div>
                                <p className="text-sm font-semibold">
                                  {model.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {model.provider}
                                </p>
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold text-neon tabular-nums">
                            {model.quality_score
                              ? Number(model.quality_score).toFixed(1)
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                          {formatParams(model.parameter_count)}
                        </td>
                        {benchmarks.slice(0, 4).map((bm) => {
                          const score = getBenchmarkScore(model, bm.slug);
                          return (
                            <td
                              key={bm.slug}
                              className="hidden px-4 py-3 text-right text-sm tabular-nums lg:table-cell"
                            >
                              {score !== null ? score.toFixed(1) : "—"}
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
                          {speed !== null
                            ? `${speed.toFixed(0)} tok/s`
                            : "—"}
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
