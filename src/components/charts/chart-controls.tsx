"use client";

import { useState, useCallback } from "react";
import { CATEGORIES as CANONICAL_CATEGORIES } from "@/lib/constants/categories";

export interface ChartFilters {
  category: string;
  providers: string[];
  dateRange: "7d" | "30d" | "90d" | "1y" | "all";
  openWeightsOnly: boolean;
}

const CATEGORIES = [
  { value: "", label: "All Categories" },
  ...CANONICAL_CATEGORIES.map((c) => ({ value: c.slug, label: c.shortLabel })),
];

const DATE_RANGES = [
  { value: "7d" as const, label: "7D" },
  { value: "30d" as const, label: "30D" },
  { value: "90d" as const, label: "90D" },
  { value: "1y" as const, label: "1Y" },
  { value: "all" as const, label: "All" },
];

const TOP_PROVIDERS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "Meta",
  "Mistral",
  "DeepSeek",
  "xAI",
  "Cohere",
  "Stability AI",
];

interface ChartControlsProps {
  filters: ChartFilters;
  onChange: (filters: ChartFilters) => void;
  showDateRange?: boolean;
  showProviders?: boolean;
  showOpenWeights?: boolean;
  className?: string;
}

export function ChartControls({
  filters,
  onChange,
  showDateRange = false,
  showProviders = true,
  showOpenWeights = true,
  className = "",
}: ChartControlsProps) {
  const update = useCallback(
    (partial: Partial<ChartFilters>) => {
      onChange({ ...filters, ...partial });
    },
    [filters, onChange]
  );

  const toggleProvider = useCallback(
    (provider: string) => {
      const current = filters.providers;
      const next = current.includes(provider)
        ? current.filter((p) => p !== provider)
        : [...current, provider];
      update({ providers: next });
    },
    [filters.providers, update]
  );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Category dropdown */}
      <select
        value={filters.category}
        onChange={(e) => update({ category: e.target.value })}
        className="rounded-md border border-white/10 bg-[#111] px-3 py-1.5 text-sm text-white/80 outline-none focus:border-[#00d4aa]/50 transition-colors"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Provider chips */}
      {showProviders && (
        <div className="flex flex-wrap gap-1">
          {TOP_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => toggleProvider(p)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                filters.providers.includes(p)
                  ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/40"
                  : "bg-white/5 text-white/40 border border-white/5 hover:border-white/20 hover:text-white/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Date range toggle */}
      {showDateRange && (
        <div className="flex rounded-md border border-white/10 overflow-hidden">
          {DATE_RANGES.map((d) => (
            <button
              key={d.value}
              onClick={() => update({ dateRange: d.value })}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                filters.dateRange === d.value
                  ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Open weights toggle */}
      {showOpenWeights && (
        <button
          onClick={() => update({ openWeightsOnly: !filters.openWeightsOnly })}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
            filters.openWeightsOnly
              ? "bg-[#00d4aa]/20 text-[#00d4aa] border-[#00d4aa]/40"
              : "bg-white/5 text-white/40 border-white/5 hover:border-white/20"
          }`}
        >
          Open Weights Only
        </button>
      )}
    </div>
  );
}

export function useChartFilters(initial?: Partial<ChartFilters>) {
  const [filters, setFilters] = useState<ChartFilters>({
    category: "",
    providers: [],
    dateRange: "30d",
    openWeightsOnly: false,
    ...initial,
  });
  return { filters, setFilters };
}
