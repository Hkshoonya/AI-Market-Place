"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_MAP } from "@/lib/constants/categories";
import { ProviderLogo } from "@/components/shared/provider-logo";

export interface ModelOption {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
}

interface ModelSelectorProps {
  allModels: ModelOption[];
  selectedSlugs: string[];
  onSelect: (slug: string) => void;
}

export function ModelSelector({
  allModels,
  selectedSlugs,
  onSelect,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = allModels.filter(
    (m) =>
      !selectedSlugs.includes(m.slug) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.provider.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <Button
        variant="outline"
        className="h-20 w-40 flex-col gap-1 border-dashed border-border/50 hover:border-neon/50 hover:bg-neon/5"
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Add Model</span>
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-72 rounded-lg border border-border bg-card shadow-xl">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search models..."
              className="w-full rounded-md bg-secondary/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-neon/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No models found
              </p>
            ) : (
              filtered.slice(0, 20).map((m) => {
                const cat = CATEGORY_MAP[m.category as keyof typeof CATEGORY_MAP];
                return (
                  <button
                    key={m.slug}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors"
                    onClick={() => {
                      onSelect(m.slug);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <ProviderLogo provider={m.provider} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.provider}</p>
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
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
