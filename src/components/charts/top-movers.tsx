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
  const summaryItems = (items ?? []).slice(0, 5);

  return (
    <ChartCard
      title="Top Movers"
      subtitle="Biggest rank changes since last update"
      loading={isLoading}
      empty={!isLoading && !error && (!data || (data.risers.length === 0 && data.fallers.length === 0))}
      emptyMessage="No rank changes detected yet"
      minHeight={300}
      controls={
        <div className="flex overflow-hidden rounded-md border border-white/10" role="group" aria-label="Top movers view">
          <button
            onClick={() => setTab("risers")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              tab === "risers"
                ? "bg-[#16c784]/20 text-[#16c784]"
                : "text-white/40 hover:text-white/60"
            }`}
            aria-pressed={tab === "risers"}
            aria-label="Show rising models"
          >
            Up Risers
          </button>
          <button
            onClick={() => setTab("fallers")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              tab === "fallers"
                ? "bg-[#ea3943]/20 text-[#ea3943]"
                : "text-white/40 hover:text-white/60"
            }`}
            aria-pressed={tab === "fallers"}
            aria-label="Show falling models"
          >
            Down Fallers
          </button>
        </div>
      }
    >
      {error && (
        <p className="p-4 text-sm text-red-500">{error?.message || "Failed to load top movers"}</p>
      )}
      {!error && !isEmpty && (
        <div className="space-y-1">
          <div className="sr-only">
            <p>{tab === "risers" ? "Top rising models" : "Top falling models"} since the last update.</p>
            <ol>
              {summaryItems.map((m) => (
                <li key={`summary-${m.slug}`}>
                  {m.name} by {m.provider}, current rank {m.currentRank}, moved {m.rankChange > 0 ? "up" : "down"} {Math.abs(m.rankChange)} places.
                </li>
              ))}
            </ol>
          </div>
          {items.map((m, i) => (
            <Link
              key={m.slug}
              href={`/models/${m.slug}`}
              className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.03]"
            >
              <span className="w-5 text-right text-xs text-white/30">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white/80 transition-colors group-hover:text-[#00d4aa]">
                  {m.name}
                </div>
                <div className="text-xs text-white/30">{m.provider} - #{m.currentRank}</div>
              </div>
              <div className="text-right">
                <div
                  className={`text-sm font-bold ${
                    m.rankChange > 0 ? "text-[#16c784]" : "text-[#ea3943]"
                  }`}
                >
                  {m.rankChange > 0 ? "Up" : "Down"} {Math.abs(m.rankChange)}
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
