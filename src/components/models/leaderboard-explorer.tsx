"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import RankingWeightControls from "./ranking-weight-controls";
import LeaderboardControls, { LENS_TABS, type RankingLens } from "./leaderboard-controls";
import LeaderboardTable, { ScoreBar } from "./leaderboard-table";
import { analytics } from "@/lib/posthog";

// ---------------------------------------------------------------------------
// Types (exported for sub-components)
// ---------------------------------------------------------------------------

export interface LeaderboardModel {
  name: string;
  slug: string;
  provider: string;
  category: string;
  overall_rank: number | null;
  category_rank: number | null;
  quality_score: number | null;
  value_score: number | null;
  is_open_weights: boolean;
  hf_downloads: number | null;
  popularity_score: number | null;
  adoption_score: number | null;
  adoption_rank: number | null;
  agent_score: number | null;
  agent_rank: number | null;
  popularity_rank: number | null;
  economic_footprint_score: number | null;
  economic_footprint_rank: number | null;
  market_cap_estimate: number | null;
  capability_score: number | null;
  capability_rank: number | null;
  usage_score: number | null;
  usage_rank: number | null;
  expert_score: number | null;
  expert_rank: number | null;
  balanced_rank: number | null;
}

interface LeaderboardExplorerProps {
  models: LeaderboardModel[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRankMap(
  models: LeaderboardModel[],
  scoreAccessor: (model: LeaderboardModel) => number | null
): Map<string, number> {
  const ranked = models
    .map((model) => ({ slug: model.slug, score: scoreAccessor(model), overallRank: model.overall_rank ?? Number.MAX_SAFE_INTEGER }))
    .filter((entry): entry is { slug: string; score: number; overallRank: number } => entry.score != null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.overallRank - b.overallRank;
    });

  return new Map(ranked.map((entry, index) => [entry.slug, index + 1]));
}

function getLensRank(
  model: LeaderboardModel,
  lens: RankingLens,
  derivedRankMaps: Record<"popularity" | "adoption" | "economic" | "value", Map<string, number>>
): number | null {
  switch (lens) {
    case "capability": return model.capability_rank;
    case "popularity": return model.popularity_rank ?? derivedRankMaps.popularity.get(model.slug) ?? null;
    case "adoption": return model.adoption_rank ?? derivedRankMaps.adoption.get(model.slug) ?? null;
    case "economic": return model.economic_footprint_rank ?? derivedRankMaps.economic.get(model.slug) ?? null;
    case "value": return derivedRankMaps.value.get(model.slug) ?? null;
    case "usage": return model.usage_rank;
    case "expert": return model.expert_rank;
    case "balanced": return model.balanced_rank;
  }
}

function getLensScore(model: LeaderboardModel, lens: RankingLens): number | null {
  switch (lens) {
    case "capability": return model.capability_score;
    case "popularity": return model.popularity_score;
    case "adoption": return model.adoption_score;
    case "economic": return model.economic_footprint_score;
    case "value": return model.value_score;
    case "usage": return model.usage_score;
    case "expert": return model.expert_score;
    case "balanced": return model.quality_score;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LeaderboardExplorer({ models }: LeaderboardExplorerProps) {
  const [activeLens, setActiveLens] = useState<RankingLens>("capability");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customSortedModels, setCustomSortedModels] = useState<LeaderboardModel[] | null>(null);

  const filteredModels = useMemo(() => {
    let result = customSortedModels ?? models;
    if (categoryFilter) {
      result = result.filter((m) => m.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q)
      );
    }
    return result;
  }, [models, customSortedModels, categoryFilter, searchQuery]);

  const derivedRankMaps = useMemo(
    () => ({
      popularity: buildRankMap(models, (model) => model.popularity_score),
      adoption: buildRankMap(models, (model) => model.adoption_score),
      economic: buildRankMap(models, (model) => model.economic_footprint_score),
      value: buildRankMap(models, (model) => model.value_score),
    }),
    [models]
  );

  const columns = useMemo<ColumnDef<LeaderboardModel>[]>(
    () => [
      {
        id: "rank",
        accessorFn: (row) => getLensRank(row, activeLens, derivedRankMaps),
        header: "#",
        cell: ({ row, table: tbl }) => {
          const pageIndex = tbl.getState().pagination.pageIndex;
          const pageSize = tbl.getState().pagination.pageSize;
          const displayRank = row.index + 1 + pageIndex * pageSize;
          return (
            <span
              className={`text-xs font-bold tabular-nums ${
                displayRank <= 3 ? "text-[#f5a623]" : displayRank <= 10 ? "text-[#00d4aa]" : "text-white/50"
              }`}
            >
              {displayRank}
            </span>
          );
        },
        size: 50,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Model",
        cell: ({ row }) => {
          const m = row.original;
          return (
            <Link
              href={`/models/${m.slug}`}
              className="group flex items-center gap-2"
            >
              <div>
                <div className="text-sm font-medium text-white/80 group-hover:text-[#00d4aa] transition-colors">
                  {m.name}
                </div>
                <div className="text-xs text-white/30 flex items-center gap-1.5">
                  {m.provider}
                  {m.is_open_weights && (
                    <span className="text-[10px] px-1 py-0 rounded bg-[#00d4aa]/10 text-[#00d4aa]">
                      Open
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        },
        size: 250,
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => (
          <span className="text-xs text-white/40 capitalize">
            {(getValue() as string)?.replace("_", " ") || "\u2014"}
          </span>
        ),
        size: 100,
      },
      {
        id: "lens_score",
        accessorFn: (row) => getLensScore(row, activeLens),
        header: LENS_TABS.find(l => l.value === activeLens)?.label ?? "Score",
        cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
        size: 140,
      },
      ...(activeLens !== "popularity"
        ? [{
            id: "popularity_score",
            accessorKey: "popularity_score",
            header: "Popularity",
            cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
            size: 140,
          } satisfies ColumnDef<LeaderboardModel>]
        : []),
      ...(activeLens !== "adoption"
        ? [{
            id: "adoption_score",
            accessorKey: "adoption_score",
            header: "Adoption",
            cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
            size: 140,
          } satisfies ColumnDef<LeaderboardModel>]
        : []),
      ...(activeLens !== "economic"
        ? [{
            id: "economic_footprint_score",
            accessorKey: "economic_footprint_score",
            header: "Economic",
            cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
            size: 140,
          } satisfies ColumnDef<LeaderboardModel>]
        : []),
      ...(activeLens !== "value"
        ? [{
            id: "value_score",
            accessorKey: "value_score",
            header: "Value",
            cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
            size: 140,
          } satisfies ColumnDef<LeaderboardModel>]
        : []),
      {
        id: "category_rank",
        accessorKey: "category_rank",
        header: "Cat. Rank",
        cell: ({ getValue }) => {
          const rank = getValue() as number | null;
          if (rank == null) return <span className="text-white/20">&mdash;</span>;
          return <span className="text-xs text-white/50 tabular-nums">#{rank}</span>;
        },
        size: 80,
      },
      {
        id: "agent_score",
        accessorKey: "agent_score",
        header: "Agent",
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          if (val == null) return <span className="text-white/20">&mdash;</span>;
          return <span className="text-xs text-[#6366f1] font-semibold tabular-nums">{val.toFixed(1)}</span>;
        },
        size: 70,
      },
      {
        id: "hf_downloads",
        accessorKey: "hf_downloads",
        header: "Downloads",
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          if (val == null) return <span className="text-white/20">&mdash;</span>;
          const formatted =
            val >= 1_000_000
              ? `${(val / 1_000_000).toFixed(1)}M`
              : val >= 1_000
                ? `${(val / 1_000).toFixed(0)}K`
                : val.toString();
          return <span className="text-xs text-white/50 tabular-nums">{formatted}</span>;
        },
        size: 90,
      },
    ],
    [activeLens, derivedRankMaps]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable() predates React compiler compatibility; cannot change library internals
  const table = useReactTable({
    data: filteredModels,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  const handleLensSwitched = (from: RankingLens, to: RankingLens) => {
    analytics.lensSwitched(from, to);
    setSorting([{ id: "rank", desc: false }]);
  };

  return (
    <div>
      <LeaderboardControls
        activeLens={activeLens}
        setActiveLens={setActiveLens}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        modelCount={filteredModels.length}
        onLensSwitched={handleLensSwitched}
        onSearchPerformed={(q, count) => analytics.searchPerformed(q, count)}
      />

      <RankingWeightControls
        models={models}
        onSortedModels={(sorted) => setCustomSortedModels(sorted)}
      />

      <LeaderboardTable table={table} />
    </div>
  );
}
