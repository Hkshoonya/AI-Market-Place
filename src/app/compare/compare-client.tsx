"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronsUpDown, X } from "lucide-react";
import { useSWRConfig } from "swr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { createClient } from "@/lib/supabase/client";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { ShareComparison } from "@/components/compare/share-comparison";
import { analytics } from "@/lib/posthog";
import type { ModelWithDetails } from "@/types/database";
import { pickBestModelSignals, type ModelSignalSummary } from "@/lib/news/model-signals";
import {
  buildAccessOffersCatalog,
  getBestAccessOfferForModel,
} from "@/lib/models/access-offers";
import { ModelSelector } from "./_components/model-selector";
import type { ModelOption } from "./_components/model-selector";
import { OverviewTable } from "./_components/overview-table";
import { BenchmarksTable } from "./_components/benchmarks-table";
import { PricingTable } from "./_components/pricing-table";
import { VisualComparison } from "./_components/visual-comparison";
import type { BenchmarkScoreWithBenchmarks } from "./_components/compare-helpers";
import type { CompareAccessOffer } from "./_components/compare-helpers";

interface CompareClientProps {
  allModels: ModelOption[];
  initialModels: ModelWithDetails[];
  initialSlugs: string[];
  initialModelSignals: Record<string, ModelSignalSummary | null>;
  initialAccessOffers: Record<string, CompareAccessOffer | null>;
}

export type { ModelOption };

export function CompareClient({
  allModels,
  initialModels,
  initialSlugs,
  initialModelSignals,
  initialAccessOffers,
}: CompareClientProps) {
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();
  const [models, setModels] = useState<ModelWithDetails[]>(initialModels);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(initialSlugs);
  const [modelSignals, setModelSignals] =
    useState<Record<string, ModelSignalSummary | null>>(initialModelSignals);
  const [accessOffers, setAccessOffers] =
    useState<Record<string, CompareAccessOffer | null>>(initialAccessOffers);
  const [loading, setLoading] = useState(false);
  const comparedRef = useRef(false);

  // Track initial comparison on mount when models are pre-selected via URL
  useEffect(() => {
    if (comparedRef.current || models.length < 2) return;
    comparedRef.current = true;
    analytics.modelCompared(models.map((m) => m.id));
  }, [models]);

  const addModel = async (slug: string) => {
    if (selectedSlugs.includes(slug) || selectedSlugs.length >= 5) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("models")
      .select(
        `
        *,
        benchmark_scores(*, benchmarks(*)),
        model_pricing(*),
        elo_ratings(*),
        rankings(*)
      `
      )
      .eq("slug", slug)
      .single();
    if (error) {
      setLoading(false);
      return;
    }
    if (data) {
      const [{ data: newsRaw }, { data: deploymentPlatformsRaw }, { data: modelDeploymentsRaw }] =
        await Promise.all([
          supabase
            .from("model_news")
            .select("id, title, source, related_provider, related_model_ids, published_at, metadata")
            .order("published_at", { ascending: false })
            .limit(200),
          supabase.from("deployment_platforms").select("*").order("name"),
          supabase
            .from("model_deployments")
            .select(
              "id, model_id, platform_id, pricing_model, price_per_unit, unit_description, free_tier, one_click, status"
            )
            .eq("model_id", data.id)
            .eq("status", "available"),
        ]);

      const modelSignalMap = pickBestModelSignals(
        [data as unknown as ModelWithDetails],
        (newsRaw ?? []).map((item) => ({
          id: typeof item.id === "string" ? item.id : null,
          title: typeof item.title === "string" ? item.title : null,
          source: typeof item.source === "string" ? item.source : null,
          related_provider:
            typeof item.related_provider === "string" ? item.related_provider : null,
          related_model_ids: Array.isArray(item.related_model_ids)
            ? item.related_model_ids.filter((value): value is string => typeof value === "string")
            : null,
          published_at:
            typeof item.published_at === "string" ? item.published_at : null,
          metadata:
            item.metadata && typeof item.metadata === "object"
              ? (item.metadata as Record<string, unknown>)
              : null,
        }))
      );

      const deploymentPlatforms = (deploymentPlatformsRaw ?? []).map((platform) => {
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
      });

      const accessCatalog = buildAccessOffersCatalog({
        platforms: deploymentPlatforms,
        deployments: (modelDeploymentsRaw ?? []) as Array<{
          id: string;
          model_id: string;
          platform_id: string;
          pricing_model: string | null;
          price_per_unit: number | null;
          unit_description: string | null;
          free_tier: string | null;
          one_click: boolean;
          status?: string | null;
        }>,
        models: [
          {
            id: data.id,
            slug: data.slug,
            name: data.name,
            provider: data.provider,
            category: data.category,
            quality_score: data.quality_score,
            capability_score: data.capability_score,
            adoption_score: data.adoption_score,
            economic_footprint_score: data.economic_footprint_score,
          },
        ],
      });
      const accessOffer = getBestAccessOfferForModel(accessCatalog, data.id);

      // Populate SWR cache for this slug
      mutateGlobal(`supabase:model:${slug}`, data, false);
      const newSlugs = [...selectedSlugs, slug];
      setSelectedSlugs(newSlugs);
      setModels((prev) => [...prev, data as unknown as ModelWithDetails]);
      setModelSignals((prev) => ({
        ...prev,
        [slug]: modelSignalMap.get(data.id) ?? null,
      }));
      setAccessOffers((prev) => ({
        ...prev,
        [slug]: accessOffer
          ? {
              monthlyPriceLabel: accessOffer.monthlyPriceLabel,
              actionLabel: accessOffer.actionLabel,
            }
          : null,
      }));
      router.replace(`/compare?models=${newSlugs.join(",")}`, {
        scroll: false,
      });
    }
    setLoading(false);
  };

  const removeModel = (slug: string) => {
    const newSlugs = selectedSlugs.filter((s) => s !== slug);
    setSelectedSlugs(newSlugs);
    setModels((prev) => prev.filter((m) => m.slug !== slug));
    setModelSignals((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    setAccessOffers((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
    if (newSlugs.length > 0) {
      router.replace(`/compare?models=${newSlugs.join(",")}`, {
        scroll: false,
      });
    } else {
      router.replace("/compare", { scroll: false });
    }
  };

  // Collect all benchmark names across selected models
  const allBenchmarks: { name: string; slug: string; category: string }[] = [];
  const seenBenchmarks = new Set<string>();
  for (const m of models) {
    for (const bs of (m.benchmark_scores as
      | BenchmarkScoreWithBenchmarks[]
      | undefined) ?? []) {
      const bm = bs.benchmarks;
      if (bm && !seenBenchmarks.has(bm.slug)) {
        seenBenchmarks.add(bm.slug);
        allBenchmarks.push({
          name: bm.name,
          slug: bm.slug,
          category: bm.category ?? "",
        });
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link
        href="/models"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Models
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compare Models</h1>
          <p className="mt-2 text-muted-foreground">
            Pick up to 5 models to compare side by side across quality, pricing,
            benchmarks, and key specs.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start with the models you are deciding between right now.
          </p>
        </div>
        {models.length >= 2 && (
          <ShareComparison
            modelNames={models.map((m) => m.name as string)}
            slugs={selectedSlugs}
          />
        )}
      </div>

      {/* Model selector bar */}
      <div className="mt-8 flex flex-wrap items-start gap-3">
        {models.map((m) => {
          const cat = CATEGORY_MAP[m.category as keyof typeof CATEGORY_MAP];
          return (
            <Card
              key={m.slug}
              className="relative w-40 border-border/50 bg-card"
            >
              <button
                className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/80 transition-colors z-10"
                onClick={() => removeModel(m.slug)}
              >
                <X className="h-3 w-3" />
              </button>
              <CardContent className="p-3 text-center">
                <p className="font-semibold text-sm truncate">{m.name}</p>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <ProviderLogo provider={m.provider} size="sm" />
                  <p className="text-xs text-muted-foreground truncate">
                    {m.provider}
                  </p>
                </div>
                {cat && (
                  <Badge
                    variant="outline"
                    className="mt-2 text-[10px] border-transparent"
                    style={{
                      backgroundColor: `${cat.color}15`,
                      color: cat.color,
                    }}
                  >
                    {cat.shortLabel}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}

        {selectedSlugs.length < 5 && (
          <ModelSelector
            allModels={allModels}
            selectedSlugs={selectedSlugs}
            onSelect={addModel}
          />
        )}
      </div>

      {loading && (
        <p className="mt-4 text-sm text-muted-foreground animate-pulse">
          Loading model data...
        </p>
      )}

      {/* Comparison tables */}
      {models.length >= 2 && (
        <div className="mt-8 space-y-6">
          <OverviewTable
            models={models}
            modelSignals={modelSignals}
            accessOffers={accessOffers}
          />
          <BenchmarksTable models={models} allBenchmarks={allBenchmarks} />
          <PricingTable models={models} accessOffers={accessOffers} />
          <VisualComparison models={models} />
        </div>
      )}

      {models.length < 2 && (
        <div className="mt-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
            <ChevronsUpDown className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Select Models to Compare</h2>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Add at least 2 models above to see the side-by-side tables.
            You can compare strengths, pricing, and benchmark results in one place.
          </p>
        </div>
      )}
    </div>
  );
}
