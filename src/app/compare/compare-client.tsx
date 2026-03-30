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
import { ModelSelector } from "./_components/model-selector";
import type { ModelOption } from "./_components/model-selector";
import { OverviewTable } from "./_components/overview-table";
import { BenchmarksTable } from "./_components/benchmarks-table";
import { PricingTable } from "./_components/pricing-table";
import { VisualComparison } from "./_components/visual-comparison";
import type { BenchmarkScoreWithBenchmarks } from "./_components/compare-helpers";

interface CompareClientProps {
  allModels: ModelOption[];
  initialModels: ModelWithDetails[];
  initialSlugs: string[];
}

export type { ModelOption };

export function CompareClient({
  allModels,
  initialModels,
  initialSlugs,
}: CompareClientProps) {
  const router = useRouter();
  const { mutate: mutateGlobal } = useSWRConfig();
  const [models, setModels] = useState<ModelWithDetails[]>(initialModels);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(initialSlugs);
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
      // Populate SWR cache for this slug
      mutateGlobal(`supabase:model:${slug}`, data, false);
      const newSlugs = [...selectedSlugs, slug];
      setSelectedSlugs(newSlugs);
      setModels((prev) => [...prev, data as unknown as ModelWithDetails]);
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
          <OverviewTable models={models} />
          <BenchmarksTable models={models} allBenchmarks={allBenchmarks} />
          <PricingTable models={models} />
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
