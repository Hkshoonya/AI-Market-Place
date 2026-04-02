"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CATEGORIES } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { FilterSheetContent } from "./filter-sheet-content";

type SortOption = "rank" | "downloads" | "newest" | "price" | "quality";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "rank", label: "Rank" },
  { value: "downloads", label: "Downloads" },
  { value: "newest", label: "Newest" },
  { value: "price", label: "Price" },
  { value: "quality", label: "Quality" },
];

interface ModelsFilterBarProps {
  totalCount: number;
}

export function ModelsFilterBar({ totalCount }: ModelsFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get("category") ?? "";
  const currentSort = (searchParams.get("sort") as SortOption) ?? "rank";
  const currentView = searchParams.get("view") ?? "list";
  const currentQuery = searchParams.get("q") ?? "";
  const currentOpenOnly = searchParams.get("open") === "true";
  const currentDeployableOnly = searchParams.get("deployable") === "true";
  const currentManagedOnly = searchParams.get("managed") === "true";
  const currentProvider = searchParams.get("provider") ?? "";
  const currentParams = searchParams.get("params") ?? "";
  const currentHasApi = searchParams.get("api") === "true";
  const currentLicense = searchParams.get("license") ?? "";
  const currentLifecycle = searchParams.get("lifecycle") === "all" ? "all" : "active";

  const activeFilterCount = [
    currentOpenOnly,
    currentDeployableOnly,
    currentManagedOnly,
    currentProvider,
    currentParams,
    currentHasApi,
    currentLicense,
  ].filter(Boolean).length;

  const [searchValue, setSearchValue] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") { params.delete(key); } else { params.set(key, value); }
      });
      if (!("page" in updates) && !("view" in updates)) { params.delete("page"); }
      startTransition(() => { router.push(`/models?${params.toString()}`, { scroll: false }); });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchValue !== currentQuery) updateParams({ q: searchValue || null });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchValue, currentQuery, updateParams]);

  useEffect(() => { setSearchValue(currentQuery); }, [currentQuery]);

  const handleClearAll = () => { setSearchValue(""); router.push("/models"); };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4">
        {/* Search Input */}
        <div className="relative w-full min-w-0">
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
              onClick={() => { setSearchValue(""); updateParams({ q: null }); }}
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
              key={cat.slug} variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentCategory === cat.slug
                  ? "border-neon/30 bg-neon/10 text-neon hover:bg-neon/20"
                  : "border-border/50 text-muted-foreground hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() => updateParams({ category: currentCategory === cat.slug ? null : cat.slug })}
            >
              <cat.icon className="mr-1 h-3 w-3" />
              {cat.shortLabel}
            </Badge>
          ))}
        </div>

        {/* Filters + View Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline" size="sm"
                className={cn("h-9 gap-1.5", activeFilterCount > 0 && "border-neon/30 text-neon")}
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
            <SheetContent side="right" className="w-[min(20rem,85dvw)] max-w-[100dvw] bg-background">
              <SheetTitle className="sr-only">Filters</SheetTitle>
              <FilterSheetContent
                currentProvider={currentProvider}
                currentParams={currentParams}
                currentLicense={currentLicense}
                currentOpenOnly={currentOpenOnly}
                currentDeployableOnly={currentDeployableOnly}
                currentManagedOnly={currentManagedOnly}
                currentHasApi={currentHasApi}
                updateParams={updateParams}
                onClearAll={handleClearAll}
              />
            </SheetContent>
          </Sheet>

          <div className="flex rounded-lg border border-border/50" role="group" aria-label="View mode">
            <Button
              variant="ghost" size="icon"
              className={cn("h-9 w-9 rounded-r-none", currentView === "list" ? "text-neon" : "text-muted-foreground")}
              onClick={() => updateParams({ view: "list" })}
              aria-label="List view" aria-pressed={currentView === "list"}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className={cn("h-9 w-9 rounded-l-none", currentView === "grid" ? "text-neon" : "text-muted-foreground")}
              onClick={() => updateParams({ view: "grid" })}
              aria-label="Grid view" aria-pressed={currentView === "grid"}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results count + sort */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {isPending ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              Showing <span className="font-medium text-foreground">{totalCount}</span>{" "}
              {currentManagedOnly
                ? "managed-deployable models"
                : currentLifecycle === "all"
                  ? "tracked models"
                  : "active models"}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="group" aria-label="Sort options">
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer text-xs transition-colors",
              currentLifecycle === "active"
                ? "border-neon/30 text-neon"
                : "border-border/50 hover:border-neon/30 hover:text-foreground"
            )}
            onClick={() => updateParams({ lifecycle: null })}
            role="button"
            aria-pressed={currentLifecycle === "active"}
            aria-label="Show active models only"
          >
            Active Only
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "cursor-pointer text-xs transition-colors",
              currentLifecycle === "all"
                ? "border-neon/30 text-neon"
                : "border-border/50 hover:border-neon/30 hover:text-foreground"
            )}
            onClick={() => updateParams({ lifecycle: "all" })}
            role="button"
            aria-pressed={currentLifecycle === "all"}
            aria-label="Include non-active models"
          >
            Include Non-Active
          </Badge>
          <span className="text-xs text-muted-foreground/80">Sort by:</span>
          {SORT_OPTIONS.map((opt) => (
            <Badge
              key={opt.value} variant="outline"
              className={cn(
                "cursor-pointer text-xs transition-colors",
                currentSort === opt.value
                  ? "border-neon/30 text-neon"
                  : "border-border/50 hover:border-neon/30 hover:text-foreground"
              )}
              onClick={() => updateParams({ sort: opt.value })}
              role="button" aria-pressed={currentSort === opt.value}
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
