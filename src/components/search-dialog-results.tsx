"use client";

import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/format";

export interface SearchResult {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  is_open_weights?: boolean;
  parameter_count?: number | null;
}

export interface MarketplaceResult {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  price: number | null;
  avg_rating: number | null;
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
                    {r.quality_score &&
                      ` \u00b7 Score: ${Number(r.quality_score).toFixed(1)}`}
                  </p>
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
