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
          />
          {searchValue && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchValue("");
                updateParams({ q: null });
              }}
            >
              <X className="h-4 w-4" />
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
                  currentOpenOnly && "border-neon/30 text-neon"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                {currentOpenOnly && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-neon text-[10px] text-black font-bold">
                    1
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
          <div className="flex rounded-lg border border-border/50">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-r-none",
                currentView === "list" ? "text-neon" : "text-muted-foreground"
              )}
              onClick={() => updateParams({ view: "list" })}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-l-none",
                currentView === "grid" ? "text-neon" : "text-muted-foreground"
              )}
              onClick={() => updateParams({ view: "grid" })}
            >
              <LayoutGrid className="h-4 w-4" />
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
            >
              {opt.label}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}
