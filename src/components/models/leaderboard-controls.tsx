"use client";

import { CATEGORY_MAP, type ModelCategory } from "@/lib/constants/categories";
import {
  PUBLIC_LENS_CONFIG,
  type PublicRankingLens,
} from "@/lib/models/public-lenses";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RankingLens =
  | PublicRankingLens
  | "usage"
  | "expert"
  | "balanced";

export const LENS_TABS = PUBLIC_LENS_CONFIG;

export const CATEGORY_TABS = [
  { value: "", label: "All" },
  { value: "llm", label: "LLMs" },
  { value: "multimodal", label: "Multimodal" },
  { value: "code", label: "Code" },
  { value: "agentic_browser", label: "Browser Agents" },
  { value: "image_generation", label: "Image Gen" },
  { value: "embeddings", label: CATEGORY_MAP.embeddings.shortLabel },
  { value: "speech_audio", label: CATEGORY_MAP.speech_audio.label },
] as const satisfies ReadonlyArray<{ value: "" | ModelCategory; label: string }>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LeaderboardControlsProps {
  activeLens: RankingLens;
  setActiveLens: (lens: RankingLens) => void;
  lifecycleFilter: "active" | "all";
  setLifecycleFilter: (filter: "active" | "all") => void;
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  modelCount: number;
  onLensSwitched: (from: RankingLens, to: RankingLens) => void;
  onSearchPerformed: (query: string, resultCount: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeaderboardControls({
  activeLens,
  setActiveLens,
  lifecycleFilter,
  setLifecycleFilter,
  categoryFilter,
  setCategoryFilter,
  searchQuery,
  setSearchQuery,
  modelCount,
  onLensSwitched,
  onSearchPerformed,
}: LeaderboardControlsProps) {
  return (
    <>
      {/* Lens Toggle */}
      <div className="flex gap-2 mb-4">
        {LENS_TABS.map((lens) => (
          <button
            key={lens.value}
            onClick={() => {
              onLensSwitched(activeLens, lens.value);
              setActiveLens(lens.value);
            }}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeLens === lens.value
                ? "bg-white text-black"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            )}
            title={lens.description}
          >
            {lens.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setLifecycleFilter("active")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              lifecycleFilter === "active"
                ? "bg-[#00d4aa]/15 text-[#00d4aa]"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            Active Only
          </button>
          <button
            onClick={() => setLifecycleFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              lifecycleFilter === "all"
                ? "bg-[#00d4aa]/15 text-[#00d4aa]"
                : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            Include Non-Active
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex rounded-lg border border-white/[0.06] overflow-hidden">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategoryFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === tab.value
                  ? "bg-[#00d4aa]/15 text-[#00d4aa]"
                  : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const q = e.target.value;
            setSearchQuery(q);
            if (q.length >= 3) {
              onSearchPerformed(q, modelCount);
            }
          }}
          placeholder="Search models..."
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#00d4aa]/30 w-48"
        />

        <div className="ml-auto text-xs text-white/30">
          {modelCount} models
        </div>
      </div>
    </>
  );
}
