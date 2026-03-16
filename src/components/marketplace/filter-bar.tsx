"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LISTING_TYPES, MARKETPLACE_SORT_OPTIONS, type MarketplaceSortOption } from "@/lib/constants/marketplace";
import { cn } from "@/lib/utils";

interface MarketplaceFilterBarProps {
  totalCount: number;
}

const AGENT_NATIVE_FILTERS = [
  {
    key: "autonomy",
    value: "ready",
    label: "Autonomous Ready",
  },
  {
    key: "contract",
    value: "manifest",
    label: "Manifest Backed",
  },
  {
    key: "seller",
    value: "agent",
    label: "Agent Sellers",
  },
] as const;

export function MarketplaceFilterBar({ totalCount }: MarketplaceFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentType = searchParams.get("type") ?? "";
  const currentSort = (searchParams.get("sort") as MarketplaceSortOption) ?? "newest";
  const currentView = searchParams.get("view") ?? "grid";
  const currentQuery = searchParams.get("q") ?? "";
  const currentAutonomy = searchParams.get("autonomy") ?? "";
  const currentContract = searchParams.get("contract") ?? "";
  const currentSeller = searchParams.get("seller") ?? "";

  const [searchValue, setSearchValue] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      if (!("page" in updates) && !("view" in updates)) {
        params.delete("page");
      }

      startTransition(() => {
        router.push(`/marketplace/browse?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchValue !== currentQuery) {
        updateParams({ q: searchValue || null });
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, currentQuery, updateParams]);

  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            className="h-10 bg-secondary pl-9 pr-9 text-sm"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search marketplace listings"
          />
          {searchValue && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchValue("");
                updateParams({ q: null });
              }}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer text-xs transition-colors",
              currentType === ""
                ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
            )}
            onClick={() => updateParams({ type: null })}
          >
            All
          </Badge>
          {LISTING_TYPES.map((lt) => (
            <Badge
              key={lt.slug}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentType === lt.slug
                  ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                  : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() =>
                updateParams({ type: currentType === lt.slug ? null : lt.slug })
              }
            >
              <lt.icon className="mr-1 h-3 w-3" />
              {lt.shortLabel}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {AGENT_NATIVE_FILTERS.map((filter) => {
            const currentValue =
              filter.key === "autonomy"
                ? currentAutonomy
                : filter.key === "contract"
                  ? currentContract
                  : currentSeller;

            return (
              <Badge
                key={filter.key}
                variant="outline"
                className={cn(
                  "cursor-pointer text-xs transition-colors",
                  currentValue === filter.value
                    ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                    : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
                )}
                onClick={() =>
                  updateParams({
                    [filter.key]:
                      currentValue === filter.value ? null : filter.value,
                  })
                }
              >
                {filter.label}
              </Badge>
            );
          })}
        </div>

        <div className="flex rounded-lg border border-border/50" role="group" aria-label="View mode">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-r-none",
              currentView === "grid" ? "text-neon" : "text-muted-foreground"
            )}
            onClick={() => updateParams({ view: "grid" })}
            aria-label="Grid view"
            aria-pressed={currentView === "grid"}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-l-none",
              currentView === "list" ? "text-neon" : "text-muted-foreground"
            )}
            onClick={() => updateParams({ view: "list" })}
            aria-label="List view"
            aria-pressed={currentView === "list"}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isPending ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-foreground">{totalCount}</span>{" "}
              listings
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="group" aria-label="Sort options">
          Sort by:
          {MARKETPLACE_SORT_OPTIONS.map((opt) => (
            <Badge
              key={opt.value}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentSort === opt.value
                  ? "border-neon/30 text-neon"
                  : "border-border/50 hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() => updateParams({ sort: opt.value })}
              role="button"
              aria-pressed={currentSort === opt.value}
              aria-label={`Sort by ${opt.label}`}
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}
