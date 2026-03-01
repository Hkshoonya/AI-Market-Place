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
  flexRender,
} from "@tanstack/react-table";
import RankingWeightControls from "./ranking-weight-controls";

interface LeaderboardModel {
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
  agent_score: number | null;
  agent_rank: number | null;
  popularity_rank: number | null;
  market_cap_estimate: number | null;
}

interface LeaderboardExplorerProps {
  models: LeaderboardModel[];
}

const CATEGORY_TABS = [
  { value: "", label: "All" },
  { value: "llm", label: "LLMs" },
  { value: "multimodal", label: "Multimodal" },
  { value: "code", label: "Code" },
  { value: "agentic_browser", label: "Agentic" },
  { value: "image_generation", label: "Image Gen" },
  { value: "embedding", label: "Embedding" },
  { value: "audio", label: "Audio" },
];

function ScoreBar({ value, max = 100 }: { value: number | null; max?: number }) {
  if (value == null) return <span className="text-white/20">—</span>;
  const pct = Math.min((value / max) * 100, 100);
  const color =
    pct >= 70
      ? "#16c784"
      : pct >= 40
        ? "#f5a623"
        : "#ea3943";

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function LeaderboardExplorer({ models }: LeaderboardExplorerProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "overall_rank", desc: false },
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

  const columns = useMemo<ColumnDef<LeaderboardModel>[]>(
    () => [
      {
        id: "overall_rank",
        accessorKey: "overall_rank",
        header: "#",
        cell: ({ getValue }) => {
          const rank = getValue() as number | null;
          if (rank == null) return <span className="text-white/20">—</span>;
          return (
            <span
              className={`text-xs font-bold tabular-nums ${
                rank <= 3 ? "text-[#f5a623]" : rank <= 10 ? "text-[#00d4aa]" : "text-white/50"
              }`}
            >
              {rank}
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
            {(getValue() as string)?.replace("_", " ") || "—"}
          </span>
        ),
        size: 100,
      },
      {
        id: "quality_score",
        accessorKey: "quality_score",
        header: "Quality",
        cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
        size: 140,
      },
      {
        id: "value_score",
        accessorKey: "value_score",
        header: "Value",
        cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
        size: 140,
      },
      {
        id: "category_rank",
        accessorKey: "category_rank",
        header: "Cat. Rank",
        cell: ({ getValue }) => {
          const rank = getValue() as number | null;
          if (rank == null) return <span className="text-white/20">—</span>;
          return <span className="text-xs text-white/50 tabular-nums">#{rank}</span>;
        },
        size: 80,
      },
      {
        id: "market_cap_estimate",
        accessorKey: "market_cap_estimate",
        header: "Market Cap",
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          if (val == null) return <span className="text-white/20">—</span>;
          const formatted =
            val >= 1_000_000
              ? `$${(val / 1_000_000).toFixed(1)}M`
              : val >= 1_000
                ? `$${(val / 1_000).toFixed(0)}K`
                : `$${val}`;
          return <span className="text-xs text-[#00d4aa] font-semibold tabular-nums">{formatted}</span>;
        },
        size: 100,
      },
      {
        id: "popularity_score",
        accessorKey: "popularity_score",
        header: "Popularity",
        cell: ({ getValue }) => <ScoreBar value={getValue() as number | null} />,
        size: 140,
      },
      {
        id: "agent_score",
        accessorKey: "agent_score",
        header: "Agent",
        cell: ({ getValue }) => {
          const val = getValue() as number | null;
          if (val == null) return <span className="text-white/20">—</span>;
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
          if (val == null) return <span className="text-white/20">—</span>;
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
    []
  );

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

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
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
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search models..."
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-[#00d4aa]/30 w-48"
        />

        <div className="ml-auto text-xs text-white/30">
          {filteredModels.length} models
        </div>
      </div>

      {/* Ranking Weight Controls */}
      <RankingWeightControls
        models={models}
        onSortedModels={(sorted) => setCustomSortedModels(sorted)}
      />

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-white/[0.06] bg-white/[0.02]"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2.5 text-left text-xs font-medium text-white/40 cursor-pointer select-none hover:text-white/60 transition-colors"
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" && (
                          <span className="text-[#00d4aa]">▲</span>
                        )}
                        {header.column.getIsSorted() === "desc" && (
                          <span className="text-[#00d4aa]">▼</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-2.5"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {table.getPageCount() > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <div className="text-xs text-white/30">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 text-xs rounded border border-white/[0.06] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 text-xs rounded border border-white/[0.06] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
