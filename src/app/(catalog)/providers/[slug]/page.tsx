import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Download,
  ExternalLink,
  Heart,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES } from "@/lib/constants/categories";
import { createPublicClient } from "@/lib/supabase/public-server";
import { z } from "zod";
import { parseQueryResultPartial } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { formatNumber, formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import {
  getCanonicalProviderName,
  getProviderBrand,
  providerMatchesCanonical,
  resolveProviderSlug,
} from "@/lib/constants/providers";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";
import { getPublicPricingSummary } from "@/lib/models/pricing";
import { formatMarketValue } from "@/lib/models/market-value";
import { getParameterDisplay } from "@/lib/models/presentation";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data } = await supabase.from("models").select("provider").eq("status", "active");
  const allProviders = [...new Set((data ?? []).map((m) => m.provider))];
  const providerName = resolveProviderSlug(slug, allProviders);

  if (!providerName) return { title: "Provider Not Found" };

  const title = `${providerName} AI Models`;
  const description = `Explore all AI models by ${providerName}. Official pricing posture, rankings, benchmark coverage, and market-value signals on ${SITE_NAME}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/providers/${slug}`,
    },
    alternates: {
      canonical: `${SITE_URL}/providers/${slug}`,
    },
  };
}

export default async function ProviderDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createPublicClient();

  const { data: providerRows } = await supabase
    .from("models")
    .select("provider")
    .eq("status", "active");
  const allProviders = [...new Set((providerRows ?? []).map((m) => m.provider))];
  const providerName = resolveProviderSlug(slug, allProviders);

  if (!providerName) notFound();

  const ProviderModelSchema = ModelBaseSchema.extend({
    model_pricing: z
      .array(
        z.object({
          provider_name: z.string().nullable().optional(),
          input_price_per_million: z.number().nullable(),
          output_price_per_million: z.number().nullable().optional(),
          source: z.string().nullable().optional(),
          currency: z.string().nullable().optional(),
        })
      )
      .optional(),
  });

  const modelsResponse = await supabase
    .from("models")
    .select("*, model_pricing(*)")
    .eq("status", "active")
    .order("overall_rank", { ascending: true, nullsFirst: false });

  const models = parseQueryResultPartial(modelsResponse, ProviderModelSchema, "ProviderModel").filter(
    (model) => providerMatchesCanonical(model.provider, providerName)
  );
  if (models.length === 0) notFound();

  const brand = getProviderBrand(providerName);
  const totalDownloads = models.reduce((sum, model) => sum + (model.hf_downloads ?? 0), 0);
  const totalLikes = models.reduce((sum, model) => sum + (model.hf_likes ?? 0), 0);
  const qualityScores = models
    .filter((model) => model.quality_score != null)
    .map((model) => Number(model.quality_score));
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : null;
  const topRank = models.find((model) => model.overall_rank != null)?.overall_rank;
  const openCount = models.filter((model) => model.is_open_weights).length;
  const topValueModel = [...models].sort(
    (left, right) =>
      Number(right.market_cap_estimate ?? 0) - Number(left.market_cap_estimate ?? 0)
  )[0];
  const officialPricedModels = models.filter(
    (model) => getPublicPricingSummary(model).official != null
  ).length;
  const verifiedPriceFloor =
    [...models]
      .map((model) => getPublicPricingSummary(model).compactPrice)
      .filter((price): price is number => price != null)
      .sort((left, right) => left - right)[0] ?? null;

  const categoryBreakdown = new Map<string, number>();
  for (const model of models) {
    categoryBreakdown.set(model.category, (categoryBreakdown.get(model.category) ?? 0) + 1);
  }
  const dominantCategory = [...categoryBreakdown.entries()].sort((a, b) => b[1] - a[1])[0];
  const dominantCategoryConfig = dominantCategory
    ? CATEGORIES.find((category) => category.slug === dominantCategory[0])
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/providers"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Providers
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <ProviderLogo provider={providerName} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">{providerName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Company footprint view: strongest categories, official pricing posture, and highest-value active models.
            </p>
            {brand && (
              <a
                href={`https://${brand.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-neon transition-colors"
              >
                {brand.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/models?provider=${encodeURIComponent(providerName)}`}>View All Models</Link>
          </Button>
          {brand && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://${brand.domain}`} target="_blank" rel="noopener noreferrer">
                Visit Website
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {[
          { label: "Models", value: models.length.toString(), icon: BarChart3 },
          { label: "Top Rank", value: topRank ? `#${topRank}` : "—", icon: BarChart3 },
          { label: "Avg Score", value: avgQuality != null ? avgQuality.toFixed(1) : "—", icon: Zap },
          { label: "Downloads", value: formatNumber(totalDownloads), icon: Download },
          { label: "Likes", value: formatNumber(totalLikes), icon: Heart },
          { label: "Open Models", value: openCount.toString(), icon: Zap },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-3 text-center">
              <stat.icon className="mx-auto mb-1 h-4 w-4 text-neon" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-8 border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Provider Footprint</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Pricing Posture
            </p>
            <p className="mt-2 text-sm font-semibold">
              {officialPricedModels} / {models.length} models have official company pricing
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Compact public tables show the cheapest verified route, while deeper pricing views keep official first-party pricing separate.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Lowest Verified Entry
            </p>
            <p className="mt-2 text-sm font-semibold">
              {verifiedPriceFloor != null ? `${formatTokenPrice(verifiedPriceFloor)}/M` : "Unavailable"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Best verified public entry point across this provider&apos;s active lineup.
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Strategic Strength
            </p>
            <p className="mt-2 text-sm font-semibold">
              {dominantCategoryConfig?.shortLabel ?? dominantCategory?.[0] ?? "Mixed portfolio"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {topValueModel
                ? `${topValueModel.name} leads current estimated value at ${formatMarketValue(topValueModel.market_cap_estimate)}.`
                : "No estimated market value available yet."}
            </p>
          </div>
        </CardContent>
      </Card>

      {categoryBreakdown.size > 1 && (
        <Card className="mb-8 border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Models by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(categoryBreakdown.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const categoryConfig = CATEGORIES.find((item) => item.slug === category);
                  return (
                    <Link
                      key={category}
                      href={`/models?provider=${encodeURIComponent(providerName!)}&category=${category}`}
                    >
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-transparent text-xs hover:border-neon/30 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: categoryConfig
                            ? `${categoryConfig.color}15`
                            : undefined,
                          color: categoryConfig?.color,
                        }}
                      >
                        {categoryConfig && <categoryConfig.icon className="h-3 w-3" />}
                        {categoryConfig?.shortLabel ?? category} ({count})
                      </Badge>
                    </Link>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Active Model Lineup ({models.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="w-12 px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Model
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                    Category
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                    Params
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                    Capability
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                    Downloads
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                    Cheapest Verified
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground xl:table-cell">
                    Est. Value
                  </th>
                  <th className="w-16 px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  const categoryConfig = CATEGORIES.find((item) => item.slug === model.category);
                  const rank = model.overall_rank ?? 0;
                  const pricingSummary = getPublicPricingSummary(model);
                  const parameterDisplay = getParameterDisplay(model);

                  return (
                    <tr
                      key={model.id}
                      className="border-b border-border/30 transition-colors hover:bg-secondary/20"
                    >
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              rank <= 3 ? "text-neon" : "text-muted-foreground"
                            }`}
                          >
                            {rank || "—"}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span className="text-sm font-semibold hover:text-neon transition-colors">
                            {model.name}
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-4 py-3.5 sm:table-cell">
                        {categoryConfig && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-transparent text-[11px]"
                            style={{
                              backgroundColor: `${categoryConfig.color}15`,
                              color: categoryConfig.color,
                            }}
                          >
                            <categoryConfig.icon className="h-3 w-3" />
                            {categoryConfig.shortLabel}
                          </Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        <span className="flex items-center justify-end gap-1">
                          <Zap className="h-3 w-3 text-neon" />
                          {parameterDisplay.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {model.quality_score ? Number(model.quality_score).toFixed(1) : "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        {formatNumber(model.hf_downloads)}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm lg:table-cell">
                        {pricingSummary.compactPrice != null ? (
                          <div className="space-y-0.5 text-muted-foreground">
                            <div>
                              {pricingSummary.compactPrice === 0
                                ? "Free"
                                : `${formatTokenPrice(pricingSummary.compactPrice)}/M`}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                              {pricingSummary.compactLabel}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground xl:table-cell">
                        {formatMarketValue(model.market_cap_estimate)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {model.is_open_weights ? (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-gain"
                            title="Open Weights"
                          />
                        ) : (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30"
                            title="Proprietary"
                          />
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
    </div>
  );
}
