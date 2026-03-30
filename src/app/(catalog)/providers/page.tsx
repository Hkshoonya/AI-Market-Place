import Link from "next/link";
import { ArrowRight, Building2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createPublicClient } from "@/lib/supabase/public-server";

import { formatNumber } from "@/lib/format";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { getCanonicalProviderName, getProviderBrand, getProviderSlug } from "@/lib/constants/providers";
import { ProviderCharts } from "@/components/charts/provider-charts";
import { pickBestProviderSignals } from "@/lib/news/provider-signals";
import { ProviderSignalBadge } from "@/components/news/provider-signal-badge";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { getCapabilityMetricValue } from "@/lib/providers/metrics";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "AI Providers Directory",
  description:
    "Explore AI model providers and organizations building the future of artificial intelligence.",
  openGraph: {
    title: "AI Providers Directory",
    description:
      "Explore AI model providers and organizations building the future of artificial intelligence.",
    url: `${SITE_URL}/providers`,
  },
  alternates: {
    canonical: `${SITE_URL}/providers`,
  },
};

export const revalidate = 300;

interface ProviderStats {
  provider: string;
  modelCount: number;
  totalDownloads: number;
  avgCapability: number | null;
  capabilityTotal: number;
  capabilitySamples: number;
  topRank: number | null;
  topModelId: string;
  openWeightsCount: number;
  categories: string[];
}

export default async function ProvidersPage() {
  const supabase = createPublicClient();

  // Fetch active provider footprints and recent provider-linked signals.
  const [{ data: models }, { data: newsRaw }] = await Promise.all([
    supabase
    .from("models")
    .select(
      "id, slug, name, provider, hf_downloads, capability_score, quality_score, economic_footprint_score, overall_rank, is_open_weights, category"
    )
    .eq("status", "active"),
    supabase
      .from("model_news")
      .select("id, title, source, related_provider, published_at, metadata")
      .not("related_provider", "is", null)
      .order("published_at", { ascending: false })
      .limit(180),
  ]);

  const uniqueModels = dedupePublicModelFamilies(models ?? []);
  const uniqueModelIds = uniqueModels.map((model) => model.id);
  const [deploymentPlatformsRaw, modelDeploymentsRaw] =
    uniqueModelIds.length > 0
      ? await Promise.all([
          supabase.from("deployment_platforms").select("*").order("name"),
          supabase
            .from("model_deployments")
            .select("id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status")
            .in("model_id", uniqueModelIds)
            .eq("status", "available"),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  // Aggregate stats by provider
  const providerMap = new Map<string, ProviderStats>();

  uniqueModels.forEach((m) => {
    const canonicalProvider = getCanonicalProviderName(m.provider);
    const capabilityValue = getCapabilityMetricValue(m);
    const existing = providerMap.get(canonicalProvider);
    if (existing) {
      existing.modelCount++;
      existing.totalDownloads += m.hf_downloads ?? 0;
      if (capabilityValue != null) {
        existing.capabilityTotal += capabilityValue;
        existing.capabilitySamples += 1;
        existing.avgCapability = existing.capabilityTotal / existing.capabilitySamples;
      }
      if (
        m.overall_rank != null &&
        (existing.topRank == null || m.overall_rank < existing.topRank)
      ) {
        existing.topRank = m.overall_rank;
        existing.topModelId = m.id;
      }
      if (m.is_open_weights) existing.openWeightsCount++;
      if (!existing.categories.includes(m.category)) {
        existing.categories.push(m.category);
      }
    } else {
      providerMap.set(canonicalProvider, {
        provider: canonicalProvider,
        modelCount: 1,
        totalDownloads: m.hf_downloads ?? 0,
        avgCapability: capabilityValue,
        capabilityTotal: capabilityValue ?? 0,
        capabilitySamples: capabilityValue != null ? 1 : 0,
        topRank: m.overall_rank,
        topModelId: m.id,
        openWeightsCount: m.is_open_weights ? 1 : 0,
        categories: [m.category],
      });
    }
  });

  // Sort by model count (descending)
  const allProviders = Array.from(providerMap.values()).sort(
    (a, b) => b.modelCount - a.modelCount
  );

  // Show top providers (2+ models) to keep the page fast
  const providers = allProviders.filter((p) => p.modelCount >= 2);
  const totalProviderCount = allProviders.length;
  const accessCatalog = buildAccessOffersCatalog({
    platforms: (deploymentPlatformsRaw.data ?? []).map((platform) => {
      const platformRecord = platform as Record<string, unknown>;
      return {
        id: platform.id,
        slug: platform.slug,
        name: platform.name,
        type: platform.type,
        base_url: platform.base_url,
        has_affiliate: platform.has_affiliate,
        affiliate_url:
          typeof platformRecord.affiliate_url === "string"
            ? platformRecord.affiliate_url
            : platform.affiliate_url_template,
        affiliate_tag:
          typeof platformRecord.affiliate_tag === "string"
            ? platformRecord.affiliate_tag
            : null,
      };
    }),
    deployments: modelDeploymentsRaw.data ?? [],
    models: uniqueModels.map((model) => ({
      id: model.id,
      slug: model.slug,
      name: model.name,
      provider: model.provider,
      category: model.category,
      quality_score: model.quality_score,
      capability_score: model.capability_score,
      economic_footprint_score: model.economic_footprint_score,
    })),
  });
  const providerSignals = pickBestProviderSignals(
    providers.map((provider) => provider.provider),
    (newsRaw ?? []).map((item) => ({
      id: typeof item.id === "string" ? item.id : null,
      title: typeof item.title === "string" ? item.title : null,
      source: typeof item.source === "string" ? item.source : null,
      related_provider:
        typeof item.related_provider === "string" ? item.related_provider : null,
      published_at:
        typeof item.published_at === "string" ? item.published_at : null,
      metadata:
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null,
    }))
  );
  const latestSignalAt =
    Array.from(providerSignals.values())
      .map((signal) => signal.publishedAt)
      .find((value) => Boolean(value)) ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">AI Providers</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Organizations and companies building the future of AI. Explore their
          models, rankings, and contributions.
        </p>
        <div className="mt-4">
          <DataFreshnessBadge
            label="Provider activity refreshed"
            timestamp={latestSignalAt}
            detail="launches + pricing"
          />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Providers", value: totalProviderCount },
          {
            label: "Total Models",
            value: providers.reduce((s, p) => s + p.modelCount, 0),
          },
          {
            label: "Open Weight Models",
            value: providers.reduce((s, p) => s + p.openWeightsCount, 0),
          },
          {
            label: "Total Downloads",
            value: formatNumber(
              providers.reduce((s, p) => s + p.totalDownloads, 0)
            ),
          },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts — top 20 for readability */}
      <ProviderCharts
        providers={providers.slice(0, 20).map((p) => ({
          name: p.provider,
          models: p.modelCount,
          downloads: p.totalDownloads,
          avgCapability: p.avgCapability,
        }))}
      />

      {/* Provider Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((prov) => {
          const brand = getProviderBrand(prov.provider);
          const slug = getProviderSlug(prov.provider);
          const bestAccessOffer = getBestAccessOfferForModel(accessCatalog, prov.topModelId);

          return (
            <Link key={prov.provider} href={`/providers/${slug}`}>
              <Card className="group border-border/50 bg-card transition-all hover:border-neon/30 hover:glow-neon h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <ProviderLogo provider={prov.provider} size="md" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold group-hover:text-neon transition-colors truncate">
                        {prov.provider}
                      </h3>
                      {brand && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ExternalLink className="h-2.5 w-2.5" />
                          {brand.domain}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-neon transition-colors shrink-0" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold">{prov.modelCount}</p>
                      <p className="text-[10px] text-muted-foreground">Models</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {prov.topRank ? `#${prov.topRank}` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Top Rank
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {prov.avgCapability != null
                          ? prov.avgCapability.toFixed(1)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Capability
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-border/50 text-muted-foreground"
                    >
                      {formatNumber(prov.totalDownloads)} downloads
                    </Badge>
                    {prov.openWeightsCount > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-gain/30 text-gain bg-gain/10"
                      >
                        {prov.openWeightsCount} open
                      </Badge>
                    )}
                    {bestAccessOffer && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-neon/30 text-neon bg-neon/10"
                      >
                        {bestAccessOffer.monthlyPriceLabel}
                      </Badge>
                    )}
                  </div>
                  {bestAccessOffer ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {bestAccessOffer.actionLabel} via {bestAccessOffer.platform.name}
                    </p>
                  ) : null}

                  {providerSignals.get(prov.provider) ? (
                    <div className="mt-3 border-t border-border/40 pt-3">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Recent Signal
                      </p>
                      <ProviderSignalBadge signal={providerSignals.get(prov.provider)!} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
