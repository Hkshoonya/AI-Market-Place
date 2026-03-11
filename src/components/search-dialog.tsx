"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchDialogResults } from "./search-dialog-results";
import { SearchDialogDefault } from "./search-dialog-default";
import type { SearchResult, MarketplaceResult } from "./search-dialog-results";

const RECENT_SEARCHES_KEY = "aimc_recent_searches";
const MAX_RECENT = 5;

interface SearchResponse {
  data?: SearchResult[];
  marketplace?: MarketplaceResult[];
}

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
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const prevOpenRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Debounce: update debouncedQuery after 250ms of inactivity (or reset with 0ms delay)
  useEffect(() => {
    const delay = query.length < 2 ? 0 : 250;
    const timer = setTimeout(() => setDebouncedQuery(query.length < 2 ? "" : query), delay);
    return () => clearTimeout(timer);
  }, [query]);

  // SWR with debounced query as key -- null key = no fetch
  const { data: searchData, isLoading: searchLoading } = useSWR<SearchResponse>(
    debouncedQuery.length >= 2
      ? `/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=8&marketplace=true`
      : null,
    { dedupingInterval: 5000, keepPreviousData: true }
  );

  const results = searchData?.data ?? [];
  const marketplaceResults = searchData?.marketplace ?? [];
  const totalItems = results.length + marketplaceResults.length;

  // Show loading when query is typed but debounce hasn't fired yet
  const loading = searchLoading || (query.length >= 2 && debouncedQuery !== query);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (open && !wasOpen) {
      // Dialog just opened: refresh recent searches and focus input
      setTimeout(() => {
        setRecentSearches(getRecentSearches());
        inputRef.current?.focus();
      }, 0);
    } else if (!open && wasOpen) {
      // Dialog just closed: reset state asynchronously
      setTimeout(() => {
        setQuery("");
        setDebouncedQuery("");
        setActiveIndex(0);
      }, 0);
    }
  }, [open]);

  const navigateModel = (slug: string) => {
    if (query.length >= 2) addRecentSearch(query);
    setOpen(false); router.push(`/models/${slug}`);
  };
  const navigateMarketplace = (slug: string) => {
    if (query.length >= 2) addRecentSearch(query);
    setOpen(false); router.push(`/marketplace/${slug}`);
  };
  const navigateCategory = (slug: string) => { setOpen(false); router.push(`/models?category=${slug}`); };
  const navigateLink = (path: string) => { setOpen(false); router.push(path); };
  const handleRecent = (q: string) => { setQuery(q); setActiveIndex(0); };
  const handleClearRecent = () => { clearRecentSearches(); setRecentSearches([]); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex < results.length && results[activeIndex]) {
        navigateModel(results[activeIndex].slug);
      } else {
        const mkIdx = activeIndex - results.length;
        if (marketplaceResults[mkIdx]) navigateMarketplace(marketplaceResults[mkIdx].slug);
      }
    }
  };

  const showDefaultState = query.length < 2 && results.length === 0;

  return (
    <>
      <Button
        variant="ghost"
        className="h-9 gap-2 px-3 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label="Open search dialog (Ctrl+K)"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden text-xs sm:inline">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-secondary px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          <span className="text-xs">{"\u2318"}</span>K
        </kbd>
      </Button>

      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === overlayRef.current) setOpen(false); }}
          role="dialog" aria-modal="true" aria-label="Search"
        >
          <div className="mx-auto mt-[15vh] w-full max-w-lg px-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef} type="text"
                  placeholder="Search AI models, marketplace..."
                  className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                  onKeyDown={handleKeyDown}
                  aria-label="Search AI models and marketplace"
                  role="combobox" aria-expanded={totalItems > 0} aria-autocomplete="list" aria-controls="search-results-listbox"
                />
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <button
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)} aria-label="Close search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {showDefaultState && (
                <SearchDialogDefault
                  recentSearches={recentSearches} onSearchRecent={handleRecent}
                  onClearRecent={handleClearRecent} onNavigateCategory={navigateCategory}
                  onNavigateLink={navigateLink}
                />
              )}

              <div id="search-results-listbox" role="listbox" aria-label="Search results">
                <SearchDialogResults
                  results={results} marketplaceResults={marketplaceResults}
                  activeIndex={activeIndex} onNavigateModel={navigateModel}
                  onNavigateMarketplace={navigateMarketplace} onSetActiveIndex={setActiveIndex}
                />
              </div>

              {query.length >= 2 && !loading && results.length === 0 && marketplaceResults.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No results found for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try different keywords or browse by category.</p>
                </div>
              )}

              {query.length >= 2 && (results.length > 0 || marketplaceResults.length > 0) && (
                <div className="border-t border-border/50 px-4 py-2">
                  <button
                    className="w-full text-center text-xs text-neon hover:text-neon/80 transition-colors py-1"
                    onClick={() => { addRecentSearch(query); setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`); }}
                  >
                    View all results for &ldquo;{query}&rdquo; &rarr;
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">{"\u2191\u2193"}</kbd>
                  <span>navigate</span>
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">{"\u21B5"}</kbd>
                  <span>select</span>
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">esc</kbd>
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
