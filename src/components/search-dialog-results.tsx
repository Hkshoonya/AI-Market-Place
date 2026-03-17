"use client";

import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { formatCurrency, formatTokenPrice } from "@/lib/format";
import { ModelSignalBadge } from "@/components/models/model-signal-badge";
import type { ModelSignalSummary } from "@/lib/news/model-signals";
import {
  getListingCommerceSignals,
  getListingPillClasses,
} from "@/lib/marketplace/presentation";

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  capability_score?: number | null;
  is_open_weights?: boolean;
  parameter_count?: number | null;
  display_description?: string | null;
  compact_price?: number | null;
  compact_price_label?: string;
  market_cap_estimate?: number | null;
  recent_signal?: ModelSignalSummary | null;
}

export interface MarketplaceResult {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  price: number | null;
  avg_rating: number | null;
  purchase_mode?: string | null;
  autonomy_mode?: string | null;
  preview_manifest?: Record<string, unknown> | null;
  mcp_manifest?: Record<string, unknown> | null;
  agent_config?: Record<string, unknown> | null;
  agent_id?: string | null;
}

interface SearchDialogResultsProps {
  results: SearchResult[];
  marketplaceResults: MarketplaceResult[];
  activeIndex: number;
  onNavigateModel: (slug: string) => void;
  onNavigateMarketplace: (slug: string) => void;
  onSetActiveIndex: (index: number) => void;
}

export function SearchDialogResults({
  results,
  marketplaceResults,
  activeIndex,
  onNavigateModel,
  onNavigateMarketplace,
  onSetActiveIndex,
}: SearchDialogResultsProps) {
  return (
    <>
      {/* Model Results */}
      {results.length > 0 && (
        <div className="max-h-80 overflow-y-auto p-2">
          <div className="px-2 py-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Models
            </span>
          </div>
          {results.map((r, i) => {
            const cat =
              CATEGORY_MAP[r.category as keyof typeof CATEGORY_MAP];
            const capabilityValue =
              typeof r.capability_score === "number" ? r.capability_score : r.quality_score;
            return (
              <button
                key={r.id}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  i === activeIndex
                    ? "bg-neon/10 text-foreground"
                    : "hover:bg-secondary/50"
                }`}
                onClick={() => onNavigateModel(r.slug)}
                onMouseEnter={() => onSetActiveIndex(i)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {r.name}
                    </span>
                    {r.overall_rank && (
                      <span className="text-xs text-neon font-bold">
                        #{r.overall_rank}
                      </span>
                    )}
                    {r.is_open_weights && (
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gain shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.provider}
                    {capabilityValue != null &&
                      ` \u00b7 Cap: ${Number(capabilityValue).toFixed(1)}`}
                    {r.compact_price != null &&
                      ` \u00b7 ${r.compact_price === 0 ? "Free" : `${formatTokenPrice(r.compact_price)}/M`}`}
                  </p>
                  {r.display_description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {r.display_description}
                    </p>
                  ) : null}
                  {r.recent_signal ? (
                    <div className="mt-1">
                      <ModelSignalBadge signal={r.recent_signal} />
                    </div>
                  ) : null}
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
          })}
        </div>
      )}

      {/* Marketplace Results */}
      {marketplaceResults.length > 0 && (
        <div className="border-t border-border/50 p-2">
          <div className="px-2 py-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" />
              Marketplace
            </span>
          </div>
          {marketplaceResults.map((r, i) => {
            const globalIdx = results.length + i;
            const commerceSignals = getListingCommerceSignals(r);
            return (
              <button
                key={r.id}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  globalIdx === activeIndex
                    ? "bg-neon/10 text-foreground"
                    : "hover:bg-secondary/50"
                }`}
                onClick={() => onNavigateMarketplace(r.slug)}
                onMouseEnter={() => onSetActiveIndex(globalIdx)}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {r.title}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{r.listing_type.replace(/_/g, " ")}</span>
                    {r.avg_rating != null && (
                      <span>&middot; &#9733; {Number(r.avg_rating).toFixed(1)}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${getListingPillClasses(commerceSignals.autonomy.tone)}`}
                    >
                      {commerceSignals.autonomy.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${getListingPillClasses(commerceSignals.manifest.tone)}`}
                    >
                      {commerceSignals.manifest.label}
                    </Badge>
                  </div>
                </div>
                <span className="text-xs font-medium shrink-0">
                  {r.price != null ? formatCurrency(r.price) : "Contact"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
