"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Flame, TrendingUp, Rocket, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatParams } from "@/lib/format";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { ProviderLogo } from "@/components/shared/provider-logo";
import { cn } from "@/lib/utils";

interface TrendingModel {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  hf_downloads: number;
  hf_likes?: number;
  hf_trending_score?: number | null;
  release_date: string | null;
  parameter_count: number | null;
  is_open_weights: boolean;
}

type TabKey = "trending" | "recent" | "popular";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "trending", label: "Trending", icon: Flame },
  { key: "recent", label: "New Releases", icon: Rocket },
  { key: "popular", label: "Most Popular", icon: Crown },
];

interface TrendingModelsProps {
  category?: string;
  limit?: number;
}

export function TrendingModels({ category, limit = 10 }: TrendingModelsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("trending");
  const [data, setData] = useState<Record<TabKey, TrendingModel[]>>({
    trending: [],
    recent: [],
    popular: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const params = new URLSearchParams({ limit: String(limit) });
        if (category) params.set("category", category);

        const res = await fetch(`/api/trending?${params}`);
        const json = await res.json();
        if (res.ok) {
          setData({
            trending: json.trending ?? [],
            recent: json.recent ?? [],
            popular: json.popular ?? [],
          });
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchTrending();
  }, [category, limit]);

  const models = data[activeTab];

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto">
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
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Models list */}
      {loading ? (
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
            return (
              <Link
                key={model.id}
                href={`/models/${model.slug}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/30 group"
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {idx + 1}
                </span>
                <ProviderLogo provider={model.provider} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate group-hover:text-neon transition-colors">
                      {model.name}
                    </span>
                    {model.is_open_weights && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gain shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{model.provider}</span>
                    {model.parameter_count && (
                      <span>· {formatParams(model.parameter_count)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {cat && (
                    <Badge
                      variant="outline"
                      className="hidden sm:flex gap-1 border-transparent text-[10px]"
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
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatNumber(model.hf_downloads)}
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
