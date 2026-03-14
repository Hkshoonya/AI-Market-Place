"use client";

import { memo } from "react";
import { type Table, flexRender } from "@tanstack/react-table";
import type { LeaderboardModel } from "./leaderboard-explorer";

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
    pct >= 70 ? "#16c784" : pct >= 40 ? "#f5a623" : "#ea3943";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
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

interface LeaderboardTableProps {
  table: Table<LeaderboardModel>;
}

export default function LeaderboardTable({ table }: LeaderboardTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06]">
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
                    className="cursor-pointer select-none px-4 py-2.5 text-left text-xs font-medium text-white/40 transition-colors hover:text-white/60"
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]"
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

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
          <div className="text-xs text-white/30">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border border-white/[0.06] px-3 py-1 text-xs text-white/50 transition-colors hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border border-white/[0.06] px-3 py-1 text-xs text-white/50 transition-colors hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
