"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";

interface SearchResult {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    } else {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json();
      setResults(json.data ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  const navigate = (slug: string) => {
    setOpen(false);
    router.push(`/models/${slug}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      navigate(results[activeIndex].slug);
    }
  };

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
                  placeholder="Search AI models..."
                  className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                />
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <button
                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Results */}
              {results.length > 0 && (
                <div className="max-h-80 overflow-y-auto p-2">
                  {results.map((r, i) => {
                    const cat = CATEGORY_MAP[r.category as keyof typeof CATEGORY_MAP];
                    return (
                      <button
                        key={r.id}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          i === activeIndex
                            ? "bg-neon/10 text-foreground"
                            : "hover:bg-secondary/50"
                        }`}
                        onClick={() => navigate(r.slug)}
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

              {/* Empty state */}
              {query.length >= 2 && !loading && results.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No models found for &ldquo;{query}&rdquo;
                  </p>
                </div>
              )}

              {/* Hint */}
              {query.length < 2 && results.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">↑↓</kbd>
                  <span>navigate</span>
                  <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5">↵</kbd>
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
