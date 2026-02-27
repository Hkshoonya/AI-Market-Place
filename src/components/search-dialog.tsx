"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP, CATEGORIES } from "@/lib/constants/categories";
import { formatCurrency } from "@/lib/format";

interface SearchResult {
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

interface MarketplaceResult {
  id: string;
  slug: string;
  title: string;
  listing_type: string;
  price: number | null;
  avg_rating: number | null;
}

const RECENT_SEARCHES_KEY = "aimc_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [marketplaceResults, setMarketplaceResults] = useState<
    MarketplaceResult[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Total navigable items: models + marketplace
  const totalItems = results.length + marketplaceResults.length;

  // Keyboard shortcut: Cmd/Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setRecentSearches(getRecentSearches());
    } else {
      setQuery("");
      setResults([]);
      setMarketplaceResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setMarketplaceResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&limit=8&marketplace=true`
      );
      const json = await res.json();
      setResults(json.data ?? []);
      setMarketplaceResults(json.marketplace ?? []);
    } catch {
      setResults([]);
      setMarketplaceResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setMarketplaceResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  const navigateModel = (slug: string) => {
    if (query.length >= 2) addRecentSearch(query);
    setOpen(false);
    router.push(`/models/${slug}`);
  };

  const navigateMarketplace = (slug: string) => {
    if (query.length >= 2) addRecentSearch(query);
    setOpen(false);
    router.push(`/marketplace/${slug}`);
  };

  const navigateCategory = (slug: string) => {
    setOpen(false);
    router.push(`/models?category=${slug}`);
  };

  const handleRecent = (q: string) => {
    setQuery(q);
    setActiveIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex < results.length && results[activeIndex]) {
        navigateModel(results[activeIndex].slug);
      } else {
        const mkIdx = activeIndex - results.length;
        if (marketplaceResults[mkIdx]) {
          navigateMarketplace(marketplaceResults[mkIdx].slug);
        }
      }
    }
  };

  const showDefaultState =
    query.length < 2 && results.length === 0;

  return (
    <>
      {/* Trigger */}
      <Button
        variant="ghost"
        className="h-9 gap-2 px-3 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-xs sm:inline">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Overlay */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === overlayRef.current) setOpen(false);
          }}
        >
          <div className="mx-auto mt-[15vh] w-full max-w-lg px-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search AI models, marketplace..."
                  className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                />
                {loading && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <button
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Default state: recent searches + category quick links */}
              {showDefaultState && (
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
                          onClick={() => {
                            clearRecentSearches();
                            setRecentSearches([]);
                          }}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((s) => (
                          <button
                            key={s}
                            className="rounded-md bg-secondary px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                            onClick={() => handleRecent(s)}
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
                          onClick={() => navigateCategory(cat.slug)}
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
                      onClick={() => {
                        setOpen(false);
                        router.push("/models?sort=newest");
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Latest Models
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push("/marketplace");
                      }}
                      className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ShoppingBag className="h-3 w-3" />
                      Marketplace
                    </button>
                  </div>
                </div>
              )}

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
                        onClick={() => navigateModel(r.slug)}
                        onMouseEnter={() => setActiveIndex(i)}
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
                              ` · Score: ${Number(r.quality_score).toFixed(1)}`}
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
                        onClick={() => navigateMarketplace(r.slug)}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {r.title}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{r.listing_type.replace(/_/g, " ")}</span>
                            {r.avg_rating != null && (
                              <span>· ★ {Number(r.avg_rating).toFixed(1)}</span>
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

              {/* Empty state */}
              {query.length >= 2 &&
                !loading &&
                results.length === 0 &&
                marketplaceResults.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No results found for &ldquo;{query}&rdquo;
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Try different keywords or browse by category.
                    </p>
                  </div>
                )}

              {/* View all link */}
              {query.length >= 2 && (results.length > 0 || marketplaceResults.length > 0) && (
                <div className="border-t border-border/50 px-4 py-2">
                  <button
                    className="w-full text-center text-xs text-neon hover:text-neon/80 transition-colors py-1"
                    onClick={() => {
                      addRecentSearch(query);
                      setOpen(false);
                      router.push(`/search?q=${encodeURIComponent(query)}`);
                    }}
                  >
                    View all results for &ldquo;{query}&rdquo; →
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">
                    ↑↓
                  </kbd>
                  <span>navigate</span>
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">
                    ↵
                  </kbd>
                  <span>select</span>
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">
                    esc
                  </kbd>
                  <span>close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
