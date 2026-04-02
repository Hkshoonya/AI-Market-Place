"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import type { LucideIcon } from "lucide-react";
import { Flame, Rocket, Crown, Newspaper, Server } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { getParameterDisplay } from "@/lib/models/presentation";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { cn } from "@/lib/utils";
import type { ModelSignalSummary } from "@/lib/news/model-signals";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";

interface TrendingModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  popularity_score?: number | null;
  adoption_score?: number | null;
  economic_footprint_score?: number | null;
  hf_downloads: number;
  hf_likes?: number;
  hf_trending_score?: number | null;
  release_date: string | null;
  created_at?: string | null;
  parameter_count: number | null;
  is_open_weights: boolean;
  coverage_score?: number;
  recent_signal?: ModelSignalSummary | null;
}

type TabKey = "trending" | "recent" | "deployable" | "popular" | "discussed";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "trending", label: "Trending", icon: Flame },
  { key: "recent", label: "New Releases", icon: Rocket },
  { key: "deployable", label: "Ways to Use", icon: Server },
  { key: "popular", label: "Most Popular", icon: Crown },
  { key: "discussed", label: "Coverage", icon: Newspaper },
];

interface TrendingModelsProps {
  category?: string;
  limit?: number;
}

export function TrendingModels({ category, limit = 10 }: TrendingModelsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("trending");

  const params = new URLSearchParams({ limit: String(limit) });
  if (category) params.set("category", category);
  const swrKey = `/api/trending?${params.toString()}`;

  const { data: rawData, isLoading } = useSWR<Record<TabKey, TrendingModel[]>>(
    swrKey,
    { ...SWR_TIERS.MEDIUM }
  );

  const data: Record<TabKey, TrendingModel[]> = {
    trending: rawData?.trending ?? [],
    recent: rawData?.recent ?? [],
    deployable: rawData?.deployable ?? [],
    popular: rawData?.popular ?? [],
    discussed: rawData?.discussed ?? [],
  };

  const models = data[activeTab];

  return (
    <div>
      <div className="mb-4 flex items-center gap-1 overflow-x-auto" role="group" aria-label="Trending model views">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "bg-neon/10 text-neon"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
            aria-pressed={activeTab === tab.key}
            aria-label={`Show ${tab.label} models`}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary" />
          ))}
        </div>
      ) : models.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No models found in this category.
        </p>
      ) : (
        <div className="space-y-1">
          {models.map((model, idx) => {
            const cat = CATEGORY_MAP[model.category as keyof typeof CATEGORY_MAP];
            const parameterDisplay = getParameterDisplay(model);
            const rightLabel =
              activeTab === "discussed"
                ? model.coverage_score != null
                  ? `Coverage ${Number(model.coverage_score).toFixed(1)}`
                  : "Coverage 0.0"
                : activeTab === "deployable"
                  ? model.recent_signal?.signalLabel ?? "Ready to Use"
                : activeTab === "popular"
                  ? model.popularity_score != null
                    ? `Pop ${Number(model.popularity_score).toFixed(0)}`
                    : formatNumber(model.hf_downloads)
                  : activeTab === "recent"
                    ? model.release_date
                      ? new Date(model.release_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "Recent"
                    : model.economic_footprint_score != null
                      ? `Eco ${Number(model.economic_footprint_score).toFixed(0)}`
                      : formatNumber(model.hf_downloads);

            return (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/30"
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {idx + 1}
                </span>
                <ProviderLogo provider={model.provider} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium group-hover:text-neon transition-colors">
                      {model.name}
                    </span>
                    {model.is_open_weights && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gain shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{model.provider}</span>
                    <span>- {parameterDisplay.label}</span>
                  </div>
                  {model.recent_signal ? (
                    <div className="mt-2">
                      <ModelSignalBadge signal={model.recent_signal} />
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {cat && (
                    <Badge
                      variant="outline"
                      className="hidden gap-1 border-transparent text-[10px] sm:flex"
                      style={{
                        backgroundColor: `${cat.color}15`,
                        color: cat.color,
                      }}
                    >
                      {cat.shortLabel}
                    </Badge>
                  )}
                  {model.quality_score != null && (
                    <span className="text-xs font-semibold tabular-nums">
                      {Number(model.quality_score).toFixed(1)}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      activeTab === "discussed" ? "font-medium text-neon" : "text-muted-foreground"
                    )}
                  >
                    {rightLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
