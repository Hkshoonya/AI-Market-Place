"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import RankingWeightControls from "./ranking-weight-controls";
import LeaderboardControls, {
  LENS_TABS,
  type RankingLens,
} from "./leaderboard-controls";
import LeaderboardTable, { ScoreBar } from "./leaderboard-table";
import { CATEGORY_MAP, type ModelCategory } from "@/lib/constants/categories";
import { analytics } from "@/lib/posthog";
import {
  getLeaderboardLensRank,
  getLeaderboardLensScore,
  sortModelsForLens,
} from "@/lib/models/leaderboard";
import { getLifecycleBadge, type LifecycleFilter } from "@/lib/models/lifecycle";
import { type PublicRankingLens } from "@/lib/models/public-lenses";

export interface LeaderboardModel {
  name: string;
  slug: string;
  provider: string;
  category: string;
  status: string;
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
  initialLens: PublicRankingLens;
  initialLifecycleFilter: LifecycleFilter;
}

function formatCategoryLabel(category: string): string {
  return (
    CATEGORY_MAP[category as ModelCategory]?.label ??
    category.replace(/_/g, " ")
  );
}

export default function LeaderboardExplorer({
  models,
  initialLens,
  initialLifecycleFilter,
}: LeaderboardExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeLens, setActiveLens] = useState<RankingLens>(initialLens);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ]);
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleFilter>(initialLifecycleFilter);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customSortedModels, setCustomSortedModels] = useState<LeaderboardModel[] | null>(null);

  useEffect(() => {
    setActiveLens(initialLens);
  }, [initialLens]);

  useEffect(() => {
    setLifecycleFilter(initialLifecycleFilter);
  }, [initialLifecycleFilter]);

  function syncRankingUrl(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const filteredModels = useMemo(() => {
    let result = customSortedModels ?? models;

    if (categoryFilter) {
      result = result.filter((model) => model.category === categoryFilter);
    }

    if (searchQuery) {
      const normalizedQuery = searchQuery.toLowerCase();
      result = result.filter(
        (model) =>
          model.name.toLowerCase().includes(normalizedQuery) ||
          model.provider.toLowerCase().includes(normalizedQuery) ||
          model.slug.toLowerCase().includes(normalizedQuery)
      );
    }

    return result;
  }, [models, customSortedModels, categoryFilter, searchQuery]);

  const tableModels = useMemo(() => {
    if (customSortedModels) return filteredModels;
    return sortModelsForLens(filteredModels, activeLens);
  }, [activeLens, customSortedModels, filteredModels]);

  const columns = useMemo<ColumnDef<LeaderboardModel>[]>(
    () => [
      {
        id: "rank",
        accessorFn: (row) => getLeaderboardLensRank(row, activeLens),
        header: "#",
        cell: ({ getValue }) => {
          const rank = getValue<number>();
          const isRanked = Number.isFinite(rank) && rank < Number.MAX_SAFE_INTEGER;
          if (!isRanked) return <span className="text-white/20">&mdash;</span>;

          return (
            <span
              className={`text-xs font-bold tabular-nums ${
                rank <= 3
                  ? "text-[#f5a623]"
                  : rank <= 10
                    ? "text-[#00d4aa]"
                    : "text-white/50"
              }`}
            >
              {rank}
            </span>
          );
        },
        size: 56,
      },
      {
        id: "name",
        accessorKey: "name",
        header: "Model",
        cell: ({ row }) => {
          const model = row.original;
          return (
            <Link href={`/models/${model.slug}`} className="group flex items-center gap-2">
              <div>
                <div className="text-sm font-medium text-white/80 transition-colors group-hover:text-[#00d4aa]">
                  {model.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/30">
                  {model.provider}
                  {model.is_open_weights && (
                    <span className="rounded bg-[#00d4aa]/10 px-1 py-0 text-[10px] text-[#00d4aa]">
                      Open
                    </span>
                  )}
                  {!getLifecycleBadge(model.status)?.rankedByDefault && (
                    <span className="rounded bg-[#f59e0b]/10 px-1 py-0 text-[10px] text-[#f59e0b]">
                      {getLifecycleBadge(model.status)?.label}
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
        cell: ({ row }) => (
          <span className="text-xs text-white/40 capitalize">
            {formatCategoryLabel(row.original.category)}
          </span>
        ),
        size: 140,
      },
      {
        id: "lens_score",
        accessorFn: (row) => getLeaderboardLensScore(row, activeLens),
        header:
          LENS_TABS.find((lens) => lens.value === activeLens)?.label ?? "Score",
        cell: ({ getValue }) => (
          <ScoreBar value={getValue() as number | null} />
        ),
        size: 148,
      },
      ...(activeLens !== "popularity"
        ? [
            {
              id: "popularity_score",
              accessorKey: "popularity_score",
              header: "Popularity",
              cell: ({ getValue }) => (
                <ScoreBar value={getValue() as number | null} />
              ),
              size: 140,
            } satisfies ColumnDef<LeaderboardModel>,
          ]
        : []),
      ...(activeLens !== "adoption"
        ? [
            {
              id: "adoption_score",
              accessorKey: "adoption_score",
              header: "Adoption",
              cell: ({ getValue }) => (
                <ScoreBar value={getValue() as number | null} />
              ),
              size: 140,
            } satisfies ColumnDef<LeaderboardModel>,
          ]
        : []),
      ...(activeLens !== "economic"
        ? [
            {
              id: "economic_footprint_score",
              accessorKey: "economic_footprint_score",
              header: "Economic",
              cell: ({ getValue }) => (
                <ScoreBar value={getValue() as number | null} />
              ),
              size: 140,
            } satisfies ColumnDef<LeaderboardModel>,
          ]
        : []),
      ...(activeLens !== "value"
        ? [
            {
              id: "value_score",
              accessorKey: "value_score",
              header: "Value",
              cell: ({ getValue }) => (
                <ScoreBar value={getValue() as number | null} />
              ),
              size: 140,
            } satisfies ColumnDef<LeaderboardModel>,
          ]
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
          const value = getValue() as number | null;
          if (value == null) return <span className="text-white/20">&mdash;</span>;
          return (
            <span className="text-xs font-semibold tabular-nums text-[#6366f1]">
              {value.toFixed(1)}
            </span>
          );
        },
        size: 72,
      },
      {
        id: "hf_downloads",
        accessorKey: "hf_downloads",
        header: "Downloads",
        cell: ({ getValue }) => {
          const value = getValue() as number | null;
          if (value == null) return <span className="text-white/20">&mdash;</span>;

          const formatted =
            value >= 1_000_000
              ? `${(value / 1_000_000).toFixed(1)}M`
              : value >= 1_000
                ? `${(value / 1_000).toFixed(0)}K`
                : value.toString();

          return <span className="text-xs text-white/50 tabular-nums">{formatted}</span>;
        },
        size: 90,
      },
    ],
    [activeLens]
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's hooks predate React compiler compatibility and are safe here.
  const table = useReactTable({
    data: tableModels,
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
        setActiveLens={(lens) => {
          setActiveLens(lens);
          syncRankingUrl({ lens });
        }}
        lifecycleFilter={lifecycleFilter}
        setLifecycleFilter={(filter) => {
          setLifecycleFilter(filter);
          syncRankingUrl({ lifecycle: filter === "active" ? null : filter });
        }}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        modelCount={tableModels.length}
        onLensSwitched={handleLensSwitched}
        onSearchPerformed={(query, count) => analytics.searchPerformed(query, count)}
      />

      <RankingWeightControls
        models={models}
        onSortedModels={(sorted) => setCustomSortedModels(sorted)}
      />

      <LeaderboardTable table={table} />
    </div>
  );
}
