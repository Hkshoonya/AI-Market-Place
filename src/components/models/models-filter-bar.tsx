"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CATEGORIES } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

type SortOption = "rank" | "downloads" | "newest" | "price" | "quality";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rank", label: "Rank" },
  { value: "downloads", label: "Downloads" },
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "quality", label: "Quality" },
];

const PROVIDER_OPTIONS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Meta",
  "Mistral AI",
  "xAI",
  "Stability AI",
  "Cohere",
  "DeepSeek",
  "Microsoft",
];

const PARAM_RANGES = [
  { label: "Any", value: "" },
  { label: "< 10B", value: "0-10" },
  { label: "10B–70B", value: "10-70" },
  { label: "70B–200B", value: "70-200" },
  { label: "> 200B", value: "200+" },
];

interface ModelsFilterBarProps {
  totalCount: number;
}

export function ModelsFilterBar({ totalCount }: ModelsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Read current params
  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = (searchParams.get("sort") as SortOption) ?? "rank";
  const currentView = searchParams.get("view") ?? "list";
  const currentQuery = searchParams.get("q") ?? "";
  const currentOpenOnly = searchParams.get("open") === "true";
  const currentProvider = searchParams.get("provider") ?? "";
  const currentParams = searchParams.get("params") ?? "";
  const currentHasApi = searchParams.get("api") === "true";
  const currentLicense = searchParams.get("license") ?? "";

  // Count active filters
  const activeFilterCount = [
    currentOpenOnly,
    currentProvider,
    currentParams,
    currentHasApi,
    currentLicense,
  ].filter(Boolean).length;

  // Local search state for debouncing
  const [searchValue, setSearchValue] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update URL params helper
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

      // Reset to page 1 when filters change (except view change)
      if (!("page" in updates) && !("view" in updates)) {
        params.delete("page");
      }

      startTransition(() => {
        router.push(`/models?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams]
  );

  // Debounced search
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

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  return (
    <>
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-card p-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search models by name, provider, or description..."
            className="h-10 bg-secondary pl-9 pr-9 text-sm"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            aria-label="Search models"
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

        {/* Category Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer text-xs transition-colors",
              currentCategory === ""
                ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
            )}
            onClick={() => updateParams({ category: null })}
          >
            All
          </Badge>
          {CATEGORIES.map((cat) => (
            <Badge
              key={cat.slug}
              variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentCategory === cat.slug
                  ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                  : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() =>
                updateParams({
                  category: currentCategory === cat.slug ? null : cat.slug,
                })
              }
            >
              <cat.icon className="mr-1 h-3 w-3" />
              {cat.shortLabel}
            </Badge>
          ))}
        </div>

        {/* Filters + View Toggle */}
        <div className="flex items-center gap-2">
          {/* Filters Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5",
                  activeFilterCount > 0 && "border-neon/30 text-neon"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[10px] text-black font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background">
              <SheetTitle className="sr-only">Filters</SheetTitle>
              <div className="mt-8 space-y-6">
                <h3 className="text-lg font-semibold">Filters</h3>

                {/* Open Weights Toggle */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Model Type
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={!currentOpenOnly ? "default" : "outline"}
                      size="sm"
                      className={
                        !currentOpenOnly
                          ? "bg-neon text-black hover:bg-neon/90"
                          : ""
                      }
                      onClick={() => updateParams({ open: null })}
                    >
                      All Models
                    </Button>
                    <Button
                      variant={currentOpenOnly ? "default" : "outline"}
                      size="sm"
                      className={
                        currentOpenOnly
                          ? "bg-neon text-black hover:bg-neon/90"
                          : ""
                      }
                      onClick={() => updateParams({ open: "true" })}
                    >
                      Open Weights Only
                    </Button>
                  </div>
                </div>

                {/* Provider Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Provider
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "cursor-pointer text-xs transition-colors",
                        !currentProvider
                          ? "border-neon/30 bg-neon/10 text-neon"
                          : "border-border/50 text-muted-foreground hover:text-foreground"
                      )}
                      onClick={() => updateParams({ provider: null })}
                    >
                      All
                    </Badge>
                    {PROVIDER_OPTIONS.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          currentProvider === p
                            ? "border-neon/30 bg-neon/10 text-neon"
                            : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() =>
                          updateParams({
                            provider: currentProvider === p ? null : p,
                          })
                        }
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Parameter Count Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    Parameter Count
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PARAM_RANGES.map((range) => (
                      <Badge
                        key={range.value || "any"}
                        variant="outline"
                        className={cn(
                          "cursor-pointer text-xs transition-colors",
                          currentParams === range.value
                            ? "border-neon/30 bg-neon/10 text-neon"
                            : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() =>
                          updateParams({
                            params: range.value || null,
                          })
                        }
                      >
                        {range.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Has API Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    API Access
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant={!currentHasApi ? "default" : "outline"}
                      size="sm"
                      className={
                        !currentHasApi
                          ? "bg-neon text-black hover:bg-neon/90"
                          : ""
                      }
                      onClick={() => updateParams({ api: null })}
                    >
                      All
                    </Button>
                    <Button
                      variant={currentHasApi ? "default" : "outline"}
                      size="sm"
                      className={
                        currentHasApi
                          ? "bg-neon text-black hover:bg-neon/90"
                          : ""
                      }
                      onClick={() => updateParams({ api: "true" })}
                    >
                      API Available
                    </Button>
                  </div>
                </div>

                {/* License Filter */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    License
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "open_source", "commercial", "research_only"].map(
                      (lic) => (
                        <Badge
                          key={lic || "all"}
                          variant="outline"
                          className={cn(
                            "cursor-pointer text-xs transition-colors",
                            currentLicense === lic
                              ? "border-neon/30 bg-neon/10 text-neon"
                              : "border-border/50 text-muted-foreground hover:text-foreground"
                          )}
                          onClick={() =>
                            updateParams({ license: lic || null })
                          }
                        >
                          {lic === ""
                            ? "All"
                            : lic === "open_source"
                              ? "Open Source"
                              : lic === "commercial"
                                ? "Commercial"
                                : "Research Only"}
                        </Badge>
                      )
                    )}
                  </div>
                </div>

                {/* Clear All */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSearchValue("");
                    router.push("/models");
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* View Toggle */}
          <div className="flex rounded-lg border border-border/50" role="group" aria-label="View mode">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-r-none",
                currentView === "list" ? "text-neon" : "text-muted-foreground"
              )}
              onClick={() => updateParams({ view: "list" })}
              aria-label="List view"
              aria-pressed={currentView === "list"}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-l-none",
                currentView === "grid" ? "text-neon" : "text-muted-foreground"
              )}
              onClick={() => updateParams({ view: "grid" })}
              aria-label="Grid view"
              aria-pressed={currentView === "grid"}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results count + sort */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isPending ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              Showing{" "}
              <span className="font-medium text-foreground">{totalCount}</span>{" "}
              models
            </>
          )}
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="group" aria-label="Sort options">
          Sort by:
          {SORT_OPTIONS.map((opt) => (
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
