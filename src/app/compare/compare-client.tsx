"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronsUpDown,
  Plus,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import {
  formatParams,
  formatContextWindow,
  formatTokenPrice,
  formatNumber,
} from "@/lib/format";
import { createBrowserClient } from "@supabase/ssr";
import { ProviderLogo } from "@/components/shared/provider-logo";
import type { ModelWithDetails, BenchmarkScore, ModelPricing, Benchmark } from "@/types/database";

// Supabase joins benchmark_scores with benchmarks table using plural name
type BenchmarkScoreWithBenchmarks = BenchmarkScore & { benchmarks?: Benchmark };

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import { BenchmarkRadarOverlay } from "@/components/charts/benchmark-radar-overlay";
import { PriceComparison } from "@/components/charts/price-comparison";
import { SpeedCostScatter } from "@/components/charts/speed-cost-scatter";
import { ShareComparison } from "@/components/compare/share-comparison";
import { getProviderBrand } from "@/lib/constants/providers";
import { analytics } from "@/lib/posthog";

interface ModelOption {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
}

interface CompareClientProps {
  allModels: ModelOption[];
  initialModels: ModelWithDetails[];
  initialSlugs: string[];
}

function ModelSelector({
  allModels,
  selectedSlugs,
  onSelect,
}: {
  allModels: ModelOption[];
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = allModels.filter(
    (m) =>
      !selectedSlugs.includes(m.slug) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.provider.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        className="h-20 w-40 flex-col gap-1 border-dashed border-border/50 hover:border-neon/50 hover:bg-neon/5"
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Add Model</span>
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-xl">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search models..."
              className="w-full rounded-md bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-neon/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No models found
              </p>
            ) : (
              filtered.slice(0, 20).map((m) => {
                const cat = CATEGORY_MAP[m.category as keyof typeof CATEGORY_MAP];
                return (
                  <button
                    key={m.slug}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors"
                    onClick={() => {
                      onSelect(m.slug);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <ProviderLogo provider={m.provider} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.provider}</p>
                    </div>
                    {cat && (
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px] border-transparent"
                        style={{
                          backgroundColor: `${cat.color}15`,
                          color: cat.color,
                        }}
                      >
                        {cat.shortLabel}
                      </Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  highlight,
}: {
  label: string;
  values: (string | number | null)[];
  highlight?: "max" | "min" | null;
}) {
  const numValues = values.map((v) =>
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null
  );

  let bestIdx = -1;
  if (highlight && numValues.some((v) => v !== null && !isNaN(v))) {
    const validValues = numValues.filter((v) => v !== null && !isNaN(v)) as number[];
    if (validValues.length > 0) {
      const target =
        highlight === "max" ? Math.max(...validValues) : Math.min(...validValues);
      bestIdx = numValues.findIndex((v) => v === target);
    }
  }

  return (
    <tr className="border-b border-border/30">
      <td className="px-4 py-3 text-sm text-muted-foreground font-medium w-40">
        {label}
      </td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm text-center tabular-nums ${
            i === bestIdx ? "text-neon font-bold" : ""
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            {v ?? "—"}
            {i === bestIdx && <Trophy className="h-3 w-3 text-neon" />}
          </div>
        </td>
      ))}
    </tr>
  );
}

export function CompareClient({
  allModels,
  initialModels,
  initialSlugs,
}: CompareClientProps) {
  const router = useRouter();
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

  const fetchModel = useCallback(
    async (slug: string) => {
      const { data } = await supabase
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
      return data;
    },
    []
  );

  const addModel = async (slug: string) => {
    if (selectedSlugs.includes(slug) || selectedSlugs.length >= 5) return;
    setLoading(true);
    const data = await fetchModel(slug);
    if (data) {
      const newSlugs = [...selectedSlugs, slug];
      setSelectedSlugs(newSlugs);
      setModels((prev) => [...prev, data as ModelWithDetails]);
      router.replace(`/compare?models=${newSlugs.join(",")}`, { scroll: false });
    }
    setLoading(false);
  };

  const removeModel = (slug: string) => {
    const newSlugs = selectedSlugs.filter((s) => s !== slug);
    setSelectedSlugs(newSlugs);
    setModels((prev) => prev.filter((m) => m.slug !== slug));
    if (newSlugs.length > 0) {
      router.replace(`/compare?models=${newSlugs.join(",")}`, { scroll: false });
    } else {
      router.replace("/compare", { scroll: false });
    }
  };

  // Collect all benchmark names across selected models
  const allBenchmarks: { name: string; slug: string; category: string }[] = [];
  const seenBenchmarks = new Set<string>();
  for (const m of models) {
    for (const bs of (m.benchmark_scores as BenchmarkScoreWithBenchmarks[] | undefined) ?? []) {
      const bm = bs.benchmarks;
      if (bm && !seenBenchmarks.has(bm.slug)) {
        seenBenchmarks.add(bm.slug);
        allBenchmarks.push({ name: bm.name, slug: bm.slug, category: bm.category ?? "" });
      }
    }
  }

  function getBenchmarkScore(model: ModelWithDetails, benchSlug: string): number | null {
    const scores = model.benchmark_scores ?? [];
    const match = (scores as BenchmarkScoreWithBenchmarks[]).find((s) => s.benchmarks?.slug === benchSlug);
    return match ? Number(match.score) : null;
  }

  function getCheapestPrice(model: ModelWithDetails): number | null {
    const pricing = model.model_pricing ?? [];
    if (pricing.length === 0) return null;
    const prices = pricing
      .map((p: ModelPricing) => Number(p.input_price_per_million))
      .filter((p: number) => !isNaN(p) && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }

  function getSpeed(model: ModelWithDetails): number | null {
    const pricing = model.model_pricing ?? [];
    const speeds = pricing
      .map((p: ModelPricing) => Number(p.median_output_tokens_per_second))
      .filter((s: number) => !isNaN(s) && s > 0);
    return speeds.length > 0 ? Math.max(...speeds) : null;
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
            Select up to 5 models for side-by-side comparison across benchmarks,
            pricing, and specifications.
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

      {/* Comparison table */}
      {models.length >= 2 && (
        <div className="mt-8 space-y-6">
          {/* Overview */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-secondary/20">
              <CardTitle className="text-lg">Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                        Metric
                      </th>
                      {models.map((m) => (
                        <th
                          key={m.slug}
                          className="px-4 py-3 text-center text-xs font-medium"
                        >
                          <Link
                            href={`/models/${m.slug}`}
                            className="hover:text-neon transition-colors"
                          >
                            {m.name}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <ComparisonRow
                      label="Provider"
                      values={models.map((m) => m.provider)}
                    />
                    <ComparisonRow
                      label="Category"
                      values={models.map((m) => {
                        const cat =
                          CATEGORY_MAP[m.category as keyof typeof CATEGORY_MAP];
                        return cat?.label ?? m.category;
                      })}
                    />
                    <ComparisonRow
                      label="Quality Score"
                      values={models.map((m) =>
                        m.quality_score
                          ? Number(m.quality_score).toFixed(1)
                          : null
                      )}
                      highlight="max"
                    />
                    <ComparisonRow
                      label="Overall Rank"
                      values={models.map((m) =>
                        m.overall_rank ? `#${m.overall_rank}` : null
                      )}
                    />
                    <ComparisonRow
                      label="Parameters"
                      values={models.map((m) =>
                        formatParams(m.parameter_count)
                      )}
                    />
                    <ComparisonRow
                      label="Context Window"
                      values={models.map((m) =>
                        m.context_window
                          ? formatContextWindow(m.context_window)
                          : null
                      )}
                    />
                    <ComparisonRow
                      label="Open Weights"
                      values={models.map((m) =>
                        m.is_open_weights ? "Yes" : "No"
                      )}
                    />
                    <ComparisonRow
                      label="Downloads"
                      values={models.map((m) =>
                        formatNumber(m.hf_downloads)
                      )}
                      highlight="max"
                    />
                    <ComparisonRow
                      label="Release Date"
                      values={models.map((m) =>
                        m.release_date
                          ? new Date(m.release_date).toLocaleDateString(
                              "en-US",
                              { month: "short", year: "numeric" }
                            )
                          : null
                      )}
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Benchmarks */}
          {allBenchmarks.length > 0 && (
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="bg-secondary/20">
                <CardTitle className="text-lg">Benchmarks</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                          Benchmark
                        </th>
                        {models.map((m) => (
                          <th
                            key={m.slug}
                            className="px-4 py-3 text-center text-xs font-medium"
                          >
                            {m.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allBenchmarks.map((bm) => (
                        <ComparisonRow
                          key={bm.slug}
                          label={bm.name}
                          values={models.map((m) => {
                            const score = getBenchmarkScore(m, bm.slug);
                            return score !== null ? score.toFixed(1) : null;
                          })}
                          highlight="max"
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <Card className="border-border/50 overflow-hidden">
            <CardHeader className="bg-secondary/20">
              <CardTitle className="text-lg">Pricing & Speed</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-40">
                        Metric
                      </th>
                      {models.map((m) => (
                        <th
                          key={m.slug}
                          className="px-4 py-3 text-center text-xs font-medium"
                        >
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <ComparisonRow
                      label="Input $/M tokens"
                      values={models.map((m) => {
                        const price = getCheapestPrice(m);
                        return price !== null
                          ? `$${price.toFixed(2)}`
                          : null;
                      })}
                      highlight="min"
                    />
                    <ComparisonRow
                      label="Output $/M tokens"
                      values={models.map((m) => {
                        const pricing = m.model_pricing ?? [];
                        if (pricing.length === 0) return null;
                        const prices = pricing
                          .map((p: ModelPricing) =>
                            Number(p.output_price_per_million)
                          )
                          .filter(
                            (p: number) => !isNaN(p) && p > 0
                          );
                        return prices.length > 0
                          ? `$${Math.min(...prices).toFixed(2)}`
                          : null;
                      })}
                      highlight="min"
                    />
                    <ComparisonRow
                      label="Speed (tok/s)"
                      values={models.map((m) => {
                        const speed = getSpeed(m);
                        return speed !== null
                          ? `${speed.toFixed(0)}`
                          : null;
                      })}
                      highlight="max"
                    />
                    <ComparisonRow
                      label="Free Tier"
                      values={models.map((m) => {
                        const pricing = m.model_pricing ?? [];
                        return pricing.some((p: ModelPricing) => p.is_free_tier)
                          ? "Yes"
                          : "No";
                      })}
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Visual Comparison */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Overlaid Benchmark Radar for all models */}
            {models.some((m) => (m.benchmark_scores ?? []).length > 0) && (
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="bg-secondary/20">
                  <CardTitle className="text-lg">
                    Benchmark Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <BenchmarkRadarOverlay
                    models={models
                      .filter((m) => (m.benchmark_scores ?? []).length > 0)
                      .map((m, i) => ({
                        modelName: m.name,
                        color: ["#00d4aa", "#f59e0b", "#ec4899", "#6366f1", "#ef4444"][i % 5],
                        scores: ((m.benchmark_scores ?? []) as BenchmarkScoreWithBenchmarks[]).map((bs) => ({
                          benchmark: bs.benchmarks?.name ?? "Unknown",
                          score: Number(bs.score),
                          maxScore: Number(bs.benchmarks?.max_score) || 100,
                        })),
                      }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Price Comparison across all models */}
            {models.some((m) => (m.model_pricing ?? []).length > 0) && (
              <Card className="border-border/50 overflow-hidden">
                <CardHeader className="bg-secondary/20">
                  <CardTitle className="text-lg">
                    Price Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <PriceComparison
                    models={models.map((m) => {
                      const pricing = m.model_pricing ?? [];
                      const cheapest = pricing
                        .filter((p: ModelPricing) => p.input_price_per_million != null)
                        .sort((a: ModelPricing, b: ModelPricing) => (a.input_price_per_million ?? 0) - (b.input_price_per_million ?? 0))[0];
                      return {
                        name: m.name,
                        inputPrice: cheapest?.input_price_per_million ?? null,
                        outputPrice: cheapest?.output_price_per_million ?? null,
                      };
                    })}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Speed vs Cost Scatter */}
          {models.some((m) => {
            const pricing = m.model_pricing ?? [];
            return pricing.some(
              (p: ModelPricing) =>
                p.median_output_tokens_per_second != null &&
                p.input_price_per_million != null
            );
          }) && (
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="bg-secondary/20">
                <CardTitle className="text-lg">Speed vs Cost</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <SpeedCostScatter
                  data={models
                    .map((m) => {
                      const pricing = m.model_pricing ?? [];
                      const best = pricing.find(
                        (p: ModelPricing) =>
                          p.median_output_tokens_per_second != null &&
                          p.input_price_per_million != null
                      );
                      if (!best) return null;
                      return {
                        name: m.name,
                        speed: Number(best.median_output_tokens_per_second),
                        cost: Number(best.input_price_per_million),
                        provider: m.provider,
                        color:
                          getProviderBrand(m.provider)?.color ?? "#888",
                      };
                    })
                    .filter(Boolean) as {
                    name: string;
                    speed: number;
                    cost: number;
                    provider: string;
                    color: string;
                  }[]}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {models.length < 2 && (
        <div className="mt-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50">
            <ChevronsUpDown className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Select Models to Compare</h2>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Add at least 2 models using the selector above to see a detailed
            side-by-side comparison of benchmarks, pricing, and specifications.
          </p>
        </div>
      )}
    </div>
  );
}
