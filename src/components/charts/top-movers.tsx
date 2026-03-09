"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";
import { ChartCard } from "./chart-card";

interface Mover {
  name: string;
  slug: string;
  provider: string;
  category: string;
  rankChange: number;
  scoreChange: number;
  currentRank: number;
  currentScore: number;
}

interface TopMoversData {
  risers: Mover[];
  fallers: Mover[];
  asOf: string;
}

export default function TopMovers() {
  const { data, error, isLoading } = useSWR<TopMoversData>(
    "/api/charts/top-movers?limit=10",
    { ...SWR_TIERS.FAST }
  );
  const [tab, setTab] = useState<"risers" | "fallers">("risers");

  const items = tab === "risers" ? data?.risers : data?.fallers;
  const isEmpty = !items || items.length === 0;

  return (
    <ChartCard
      title="Top Movers"
      subtitle="Biggest rank changes since last update"
      loading={isLoading}
      empty={!isLoading && !error && (!data || (data.risers.length === 0 && data.fallers.length === 0))}
      emptyMessage="No rank changes detected yet"
      minHeight={300}
      controls={
        <div className="flex rounded-md border border-white/10 overflow-hidden">
          <button
            onClick={() => setTab("risers")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              tab === "risers"
                ? "bg-[#16c784]/20 text-[#16c784]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            ▲ Risers
          </button>
          <button
            onClick={() => setTab("fallers")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              tab === "fallers"
                ? "bg-[#ea3943]/20 text-[#ea3943]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            ▼ Fallers
          </button>
        </div>
      }
    >
      {error && (
        <p className="text-sm text-red-500 p-4">{error?.message || "Failed to load top movers"}</p>
      )}
      {!error && !isEmpty && (
        <div className="space-y-1">
          {items.map((m, i) => (
            <Link
              key={m.slug}
              href={`/models/${m.slug}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
            >
              <span className="text-xs text-white/30 w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white/80 truncate group-hover:text-[#00d4aa] transition-colors">
                  {m.name}
                </div>
                <div className="text-xs text-white/30">{m.provider} · #{m.currentRank}</div>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-bold ${
                    m.rankChange > 0 ? "text-[#16c784]" : "text-[#ea3943]"
                  }`}
                >
                  {m.rankChange > 0 ? "▲" : "▼"} {Math.abs(m.rankChange)}
                </div>
                {m.scoreChange !== 0 && (
                  <div className="text-xs text-white/30">
                    {m.scoreChange > 0 ? "+" : ""}
                    {m.scoreChange.toFixed(1)} pts
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </ChartCard>
  );
}
