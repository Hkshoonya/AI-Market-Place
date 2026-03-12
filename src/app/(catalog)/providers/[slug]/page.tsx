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
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { z } from "zod";
import { parseQueryResult } from "@/lib/schemas/parse";
import { ModelBaseSchema } from "@/lib/schemas/models";
import { formatNumber, formatParams, formatTokenPrice } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { getProviderBrand, PROVIDER_BRANDS } from "@/lib/constants/providers";
import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants/site";

export const revalidate = 3600;

// Map slug back to actual provider name
function slugToProvider(slug: string): string | null {
  for (const name of Object.keys(PROVIDER_BRANDS)) {
    if (name.toLowerCase().replace(/\s+/g, "-") === slug) {
      return name;
    }
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Try static lookup first
  let providerName = slugToProvider(slug);

  if (!providerName) {
    // Fall back to DB lookup
    const supabase = await createClient();
    const { data } = await supabase
      .from("models")
      .select("provider")
      .eq("status", "active");

    const allProviders = [...new Set((data ?? []).map((m) => m.provider))];
    providerName = allProviders.find(
      (p) => p.toLowerCase().replace(/\s+/g, "-") === slug
    ) ?? null;
  }

  if (!providerName) {
    return { title: "Provider Not Found" };
  }

  const title = `${providerName} AI Models`;
  const description = `Explore all AI models by ${providerName}. Rankings, benchmarks, pricing, and comparisons on ${SITE_NAME}.`;

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
  const supabase = await createClient();

  // Resolve provider name from slug
  let providerName = slugToProvider(slug);

  if (!providerName) {
    const { data } = await supabase
      .from("models")
      .select("provider")
      .eq("status", "active");

    const allProviders = [...new Set((data ?? []).map((m) => m.provider))];
    providerName = allProviders.find(
      (p) => p.toLowerCase().replace(/\s+/g, "-") === slug
    ) ?? null;
  }

  if (!providerName) {
    notFound();
  }

  // Fetch all models for this provider
  const ProviderModelSchema = ModelBaseSchema.extend({
    model_pricing: z.array(z.object({
      input_price_per_million: z.number().nullable(),
    })).optional(),
  });

  const modelsResponse = await supabase
    .from("models")
    .select("*, model_pricing(*)")
    .eq("status", "active")
    .eq("provider", providerName)
    .order("overall_rank", { ascending: true, nullsFirst: false });

  const models = parseQueryResult(modelsResponse, ProviderModelSchema, "ProviderModel");

  if (models.length === 0) {
    notFound();
  }

  const brand = getProviderBrand(providerName);

  // Compute stats
  const totalDownloads = models.reduce(
    (s, m) => s + (m.hf_downloads ?? 0),
    0
  );
  const totalLikes = models.reduce((s, m) => s + (m.hf_likes ?? 0), 0);
  const qualityScores = models
    .filter((m) => m.quality_score != null)
    .map((m) => Number(m.quality_score));
  const avgQuality =
    qualityScores.length > 0
      ? qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length
      : null;
  const topRank = models.find((m) => m.overall_rank != null)?.overall_rank;
  const openCount = models.filter((m) => m.is_open_weights).length;

  // Category breakdown
  const categoryBreakdown = new Map<string, number>();
  models.forEach((m) => {
    categoryBreakdown.set(
      m.category,
      (categoryBreakdown.get(m.category) ?? 0) + 1
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Back nav */}
      <Link
        href="/providers"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Providers
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div className="flex items-center gap-4">
          <ProviderLogo provider={providerName} size="lg" />
          <div>
            <h1 className="text-3xl font-bold">{providerName}</h1>
            {brand && (
              <a
                href={`https://${brand.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-neon transition-colors flex items-center gap-1 mt-0.5"
              >
                {brand.domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/models?provider=${encodeURIComponent(providerName)}`}>
              View All Models
            </Link>
          </Button>
          {brand && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://${brand.domain}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit Website
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6 mb-8">
        {[
          {
            label: "Models",
            value: models.length.toString(),
            icon: BarChart3,
          },
          {
            label: "Top Rank",
            value: topRank ? `#${topRank}` : "—",
            icon: BarChart3,
          },
          {
            label: "Avg Score",
            value: avgQuality != null ? avgQuality.toFixed(1) : "—",
            icon: Zap,
          },
          {
            label: "Downloads",
            value: formatNumber(totalDownloads),
            icon: Download,
          },
          {
            label: "Likes",
            value: formatNumber(totalLikes),
            icon: Heart,
          },
          {
            label: "Open Models",
            value: openCount.toString(),
            icon: Zap,
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-3 text-center">
              <stat.icon className="mx-auto h-4 w-4 text-neon mb-1" />
              <p className="text-lg font-bold">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown */}
      {categoryBreakdown.size > 1 && (
        <Card className="border-border/50 bg-card mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Models by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Array.from(categoryBreakdown.entries())
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => {
                  const catConfig = CATEGORIES.find(
                    (c) => c.slug === cat
                  );
                  return (
                    <Link
                      key={cat}
                      href={`/models?provider=${encodeURIComponent(providerName!)}&category=${cat}`}
                    >
                      <Badge
                        variant="outline"
                        className="gap-1.5 border-transparent text-xs hover:border-neon/30 transition-colors cursor-pointer"
                        style={{
                          backgroundColor: catConfig
                            ? `${catConfig.color}15`
                            : undefined,
                          color: catConfig?.color,
                        }}
                      >
                        {catConfig && (
                          <catConfig.icon className="h-3 w-3" />
                        )}
                        {catConfig?.shortLabel ?? cat} ({count})
                      </Badge>
                    </Link>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Models Table */}
      <Card className="border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">
            All Models ({models.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-12">
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
                    Score
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground md:table-cell">
                    Downloads
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium text-muted-foreground lg:table-cell">
                    Price
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground w-16">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model) => {
                  const catConfig = CATEGORIES.find(
                    (c) => c.slug === model.category
                  );
                  const rank = model.overall_rank ?? 0;
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
                      <td className="px-4 py-3.5">
                        <Link href={`/models/${model.slug}`}>
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              rank <= 3
                                ? "text-neon"
                                : "text-muted-foreground"
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
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        {model.parameter_count ? (
                          <span className="flex items-center justify-end gap-1">
                            <Zap className="h-3 w-3 text-neon" />
                            {formatParams(model.parameter_count)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold tabular-nums">
                          {model.quality_score
                            ? Number(model.quality_score).toFixed(1)
                            : "—"}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm text-muted-foreground md:table-cell">
                        {formatNumber(model.hf_downloads)}
                      </td>
                      <td className="hidden px-4 py-3.5 text-right text-sm lg:table-cell">
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
