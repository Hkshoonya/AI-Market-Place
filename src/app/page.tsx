import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Rocket,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatParams, formatTokenPrice } from "@/lib/format";
import { HeroSection } from "@/components/hero-section";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { ProviderMarketShare } from "@/components/charts/provider-market-share";
import { CategoryDistribution } from "@/components/charts/category-distribution";
import { getProviderBrand } from "@/lib/constants/providers";

export const revalidate = 3600;

export default async function HomePage() {
  const supabase = await createClient();

  // Fetch top 10 models by overall rank
  const { data: topModelsRaw } = await supabase
    .from("models")
    .select("*, rankings(*), model_pricing(*)")
    .eq("status", "active")
    .not("overall_rank", "is", null)
    .order("overall_rank", { ascending: true })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topModels = topModelsRaw as any[] | null;

  // Fetch newest models
  const { data: newModelsRaw } = await supabase
    .from("models")
    .select("*")
    .eq("status", "active")
    .order("release_date", { ascending: false })
    .limit(4);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newModels = newModelsRaw as any[] | null;

  // Get counts
  const { count: modelCount } = await supabase
    .from("models")
    .select("*", { count: "exact", head: true });

  const { count: benchmarkCount } = await supabase
    .from("benchmarks")
    .select("*", { count: "exact", head: true });

  const providerResult = await supabase
    .from("models")
    .select("provider")
    .eq("status", "active");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniqueProviders = new Set(
    (providerResult.data as any[])?.map((m) => m.provider)
  ).size;

  // Provider market share data
  const { data: providerCounts } = await supabase
    .from("models")
    .select("provider")
    .eq("status", "active");

  // Category distribution data
  const { data: categoryCounts } = await supabase
    .from("models")
    .select("category")
    .eq("status", "active");

  // Aggregate provider counts
  const providerMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (providerCounts ?? []).forEach((m: any) => {
    providerMap.set(m.provider, (providerMap.get(m.provider) ?? 0) + 1);
  });

  const providerChartData = Array.from(providerMap.entries())
    .map(([provider, count]) => ({
      provider,
      count,
      color: getProviderBrand(provider)?.color ?? "#666",
    }))
    .sort((a, b) => b.count - a.count);

  // Aggregate category counts
  const categoryMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (categoryCounts ?? []).forEach((m: any) => {
    categoryMap.set(m.category, (categoryMap.get(m.category) ?? 0) + 1);
  });

  const categoryChartData = Array.from(categoryMap.entries())
    .map(([cat, count]) => {
      const config = CATEGORIES.find((c) => c.slug === cat);
      return {
        category: config?.shortLabel ?? cat,
        count,
        color: config?.color ?? "#666",
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="relative">
      {/* 3D Hero Section — Client Component Island */}
      <HeroSection
        stats={{
          modelCount: modelCount ?? 0,
          categoryCount: 9,
          providerCount: uniqueProviders,
          benchmarkCount: benchmarkCount ?? 0,
        }}
      />

      {/* Top 10 Leaderboard */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">Top AI Models</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/leaderboards">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border/50">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                  Model
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                  Category
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Score
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                  Downloads
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {topModels?.map((model) => {
                const catConfig = CATEGORIES.find(
                  (c) => c.slug === model.category
                );
                const overallRanking = (
                  model.rankings as {
                    ranking_type: string;
                    previous_rank: number | null;
                  }[]
                )?.find((r) => r.ranking_type === "overall");
                const rank = model.overall_rank ?? 0;
                const change = overallRanking?.previous_rank
                  ? overallRanking.previous_rank - rank
                  : 0;
                const cheapestPricing = (
                  model.model_pricing as {
                    input_price_per_million: number | null;
                  }[]
                )
                  ?.filter((p) => p.input_price_per_million != null)
                  .sort(
                    (a, b) =>
                      (a.input_price_per_million ?? 0) -
                      (b.input_price_per_million ?? 0)
                  )[0];

                return (
                  <tr
                    key={model.id}
                    className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/models/${model.slug}`}>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            rank <= 3 ? "text-neon" : "text-muted-foreground"
                          }`}
                        >
                          {rank}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/models/${model.slug}`}>
                        <div className="flex items-center gap-2">
                          <ProviderLogo provider={model.provider} size="sm" />
                          <div>
                            <span className="text-sm font-semibold hover:text-neon transition-colors">
                              {model.name}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {model.provider}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {catConfig && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-transparent text-[11px]"
                          style={{
                            backgroundColor: `${catConfig.color}15`,
                            color: catConfig.color,
                          }}
                        >
                          <catConfig.icon className="h-3 w-3" />
                          {catConfig.shortLabel}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold tabular-nums">
                        {model.quality_score
                          ? Number(model.quality_score).toFixed(1)
                          : "—"}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-muted-foreground md:table-cell">
                      {formatNumber(model.hf_downloads)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm lg:table-cell">
                      {cheapestPricing ? (
                        <span className="text-muted-foreground">
                          {formatTokenPrice(
                            cheapestPricing.input_price_per_million
                          )}
                          /M
                        </span>
                      ) : model.is_open_weights ? (
                        <span className="text-gain font-medium">Free</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`flex items-center justify-end gap-1 text-xs font-medium ${
                          change > 0
                            ? "text-gain"
                            : change < 0
                              ? "text-loss"
                              : "text-muted-foreground"
                        }`}
                      >
                        {change > 0 && "▲"}
                        {change < 0 && "▼"}
                        {change === 0 && "—"}
                        {change !== 0 && Math.abs(change)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* New Launches */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 text-neon" />
            <h2 className="text-xl font-bold">New Launches</h2>
          </div>
          <Button variant="ghost" size="sm" className="text-neon" asChild>
            <Link href="/models">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newModels?.map((model) => {
            const catConfig = CATEGORIES.find(
              (c) => c.slug === model.category
            );
            const releaseDate = model.release_date
              ? new Date(model.release_date)
              : null;
            const daysAgo = releaseDate
              ? Math.floor(
                  (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
                )
              : null;
            const dateLabel =
              daysAgo !== null
                ? daysAgo === 0
                  ? "Today"
                  : daysAgo === 1
                    ? "Yesterday"
                    : daysAgo < 7
                      ? `${daysAgo} days ago`
                      : daysAgo < 30
                        ? `${Math.floor(daysAgo / 7)} week${Math.floor(daysAgo / 7) > 1 ? "s" : ""} ago`
                        : `${Math.floor(daysAgo / 30)} month${Math.floor(daysAgo / 30) > 1 ? "s" : ""} ago`
                : "";

            return (
              <Link key={model.id} href={`/models/${model.slug}`}>
                <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon h-full">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="border-gain/30 bg-gain/10 text-[11px] text-gain"
                      >
                        NEW
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {dateLabel}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold group-hover:text-neon transition-colors">
                      {model.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <ProviderLogo provider={model.provider} size="sm" />
                      <p className="text-xs text-muted-foreground">
                        {model.provider}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {catConfig && (
                        <Badge
                          variant="outline"
                          className="gap-1 border-transparent text-[11px]"
                          style={{
                            backgroundColor: `${catConfig.color}15`,
                            color: catConfig.color,
                          }}
                        >
                          <catConfig.icon className="h-3 w-3" />
                          {catConfig.shortLabel}
                        </Badge>
                      )}
                      {model.parameter_count && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-neon" />
                          {formatParams(model.parameter_count)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Categories Grid */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-neon" />
          <h2 className="text-xl font-bold">Browse by Category</h2>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <Link key={cat.slug} href={`/models?category=${cat.slug}`}>
              <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon">
                <CardContent className="flex items-center gap-4 p-4">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${cat.color}15` }}
                  >
                    <cat.icon
                      className="h-6 w-6"
                      style={{ color: cat.color }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold group-hover:text-neon transition-colors">
                      {cat.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {cat.description}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-neon transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Analytics Section */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl font-bold mb-6">Market Analytics</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Provider Market Share</CardTitle>
            </CardHeader>
            <CardContent>
              <ProviderMarketShare data={providerChartData} />
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Models by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryDistribution data={categoryChartData} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Card className="relative overflow-hidden border-neon/20 bg-gradient-to-r from-neon/5 via-neon/10 to-neon/5">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-neon/5 to-transparent" />
          <CardContent className="relative flex flex-col items-center p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold md:text-3xl">
              List your AI model on the marketplace
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Reach thousands of developers and businesses looking for AI
              models. Sell API access, fine-tuned models, datasets, and more.
            </p>
            <Button
              size="lg"
              className="mt-6 bg-neon text-background font-semibold hover:bg-neon/90"
              asChild
            >
              <Link href="/sell">
                Start Selling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
