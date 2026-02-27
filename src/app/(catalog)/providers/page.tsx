import Link from "next/link";
import { ArrowRight, Building2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { getProviderBrand } from "@/lib/constants/providers";
import { ProviderCharts } from "@/components/charts/provider-charts";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Providers Directory",
  description:
    "Explore AI model providers and organizations building the future of artificial intelligence.",
};

export const revalidate = 3600;

interface ProviderStats {
  provider: string;
  modelCount: number;
  totalDownloads: number;
  avgQuality: number | null;
  topRank: number | null;
  openWeightsCount: number;
  categories: string[];
}

export default async function ProvidersPage() {
  const supabase = await createClient();

  // Fetch all active models with key fields
  const { data: models } = await supabase
    .from("models")
    .select(
      "provider, hf_downloads, quality_score, overall_rank, is_open_weights, category"
    )
    .eq("status", "active");

  // Aggregate stats by provider
  const providerMap = new Map<string, ProviderStats>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (models as any[] ?? []).forEach((m) => {
    const existing = providerMap.get(m.provider);
    if (existing) {
      existing.modelCount++;
      existing.totalDownloads += m.hf_downloads ?? 0;
      if (m.quality_score != null) {
        if (existing.avgQuality == null) {
          existing.avgQuality = Number(m.quality_score);
        } else {
          existing.avgQuality =
            (existing.avgQuality * (existing.modelCount - 1) +
              Number(m.quality_score)) /
            existing.modelCount;
        }
      }
      if (
        m.overall_rank != null &&
        (existing.topRank == null || m.overall_rank < existing.topRank)
      ) {
        existing.topRank = m.overall_rank;
      }
      if (m.is_open_weights) existing.openWeightsCount++;
      if (!existing.categories.includes(m.category)) {
        existing.categories.push(m.category);
      }
    } else {
      providerMap.set(m.provider, {
        provider: m.provider,
        modelCount: 1,
        totalDownloads: m.hf_downloads ?? 0,
        avgQuality: m.quality_score != null ? Number(m.quality_score) : null,
        topRank: m.overall_rank,
        openWeightsCount: m.is_open_weights ? 1 : 0,
        categories: [m.category],
      });
    }
  });

  // Sort by model count (descending)
  const providers = Array.from(providerMap.values()).sort(
    (a, b) => b.modelCount - a.modelCount
  );

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
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {[
          { label: "Providers", value: providers.length },
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

      {/* Charts */}
      <ProviderCharts
        providers={providers.map((p) => ({
          name: p.provider,
          models: p.modelCount,
          downloads: p.totalDownloads,
          avgQuality: p.avgQuality,
        }))}
      />

      {/* Provider Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((prov) => {
          const brand = getProviderBrand(prov.provider);
          const slug = prov.provider.toLowerCase().replace(/\s+/g, "-");

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
                        {prov.avgQuality != null
                          ? prov.avgQuality.toFixed(1)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Avg Score
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
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
