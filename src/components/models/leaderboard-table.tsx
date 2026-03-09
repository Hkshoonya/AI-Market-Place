"use client";

import { memo } from "react";
import { type Table, flexRender } from "@tanstack/react-table";
import type { LeaderboardModel } from "./leaderboard-explorer";

// ---------------------------------------------------------------------------
// ScoreBar -- memo'd since it renders per-cell per-row (50+ instances/page)
// ---------------------------------------------------------------------------

export const ScoreBar = memo(function ScoreBar({
  value,
  max = 100,
}: {
  value: number | null;
  max?: number;
}) {
  if (value == null) return <span className="text-white/20">&mdash;</span>;
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
});

// ---------------------------------------------------------------------------
// LeaderboardTable
// ---------------------------------------------------------------------------

interface LeaderboardTableProps {
  table: Table<LeaderboardModel>;
}

export default function LeaderboardTable({ table }: LeaderboardTableProps) {
  return (
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
                        <span className="text-[#00d4aa]">&#x25B2;</span>
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <span className="text-[#00d4aa]">&#x25BC;</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, visualIndex) => {
              const pageIndex = table.getState().pagination.pageIndex;
              const pageSize = table.getState().pagination.pageSize;
              const displayRank = visualIndex + 1 + pageIndex * pageSize;
              return (
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
                      {cell.column.id === "rank" ? (
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            displayRank <= 3 ? "text-[#f5a623]" : displayRank <= 10 ? "text-[#00d4aa]" : "text-white/50"
                          }`}
                        >
                          {displayRank}
                        </span>
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
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
              &larr; Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 text-xs rounded border border-white/[0.06] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
