"use client";

import { TrendingUp, ShoppingBag } from "lucide-react";
import { CATEGORIES } from "@/lib/constants/categories";

interface SearchDialogDefaultProps {
  recentSearches: string[];
  onSearchRecent: (query: string) => void;
  onClearRecent: () => void;
  onNavigateCategory: (slug: string) => void;
  onNavigateLink: (path: string) => void;
}

export function SearchDialogDefault({
  recentSearches,
  onSearchRecent,
  onClearRecent,
  onNavigateCategory,
  onNavigateLink,
}: SearchDialogDefaultProps) {
  return (
    <div className="max-h-96 overflow-y-auto p-3">
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Recent
            </span>
            <button
              className="text-[11px] text-muted-foreground hover:text-foreground"
              onClick={onClearRecent}
              aria-label="Clear recent searches"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((s) => (
              <button
                key={s}
                className="rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                onClick={() => onSearchRecent(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Categories */}
      <div>
        <span className="px-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Browse by Category
        </span>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {CATEGORIES.slice(0, 6).map((cat) => (
            <button
              key={cat.slug}
              onClick={() => onNavigateCategory(cat.slug)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/50"
            >
              <cat.icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: cat.color }}
              />
              <span className="text-xs font-medium truncate">
                {cat.shortLabel}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onNavigateLink("/models?sort=newest")}
          className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <TrendingUp className="h-3 w-3" />
          Latest Models
        </button>
        <button
          onClick={() => onNavigateLink("/marketplace")}
          className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ShoppingBag className="h-3 w-3" />
          Marketplace
        </button>
      </div>
    </div>
  );
}
