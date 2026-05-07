"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { SWR_TIERS } from "@/lib/swr/config";

interface HomeMoverItem {
  name: string;
  slug: string;
  rankChange: number;
  currentRank: number;
}

interface HomeMoverPayload {
  risers: HomeMoverItem[];
  fallers: HomeMoverItem[];
}

export function HomepageMoverStrip() {
  const { data } = useSWR<HomeMoverPayload>("/api/charts/top-movers?limit=2", {
    ...SWR_TIERS.FAST,
  });

  const risers = data?.risers ?? [];
  const fallers = data?.fallers ?? [];

  if (risers.length === 0 && fallers.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        ↑/↓ in last 24h
      </span>
      {risers.map((item) => (
        <Link
          key={`riser-${item.slug}`}
          href={`/models/${item.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-200 transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/15"
        >
          <ArrowUpRight className="h-3 w-3" />
          <span className="font-medium">{item.name}</span>
          <span className="tabular-nums">+{item.rankChange}</span>
        </Link>
      ))}
      {fallers.map((item) => (
        <Link
          key={`faller-${item.slug}`}
          href={`/models/${item.slug}`}
          className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-rose-200 transition-colors hover:border-rose-400/40 hover:bg-rose-500/15"
        >
          <ArrowDownRight className="h-3 w-3" />
          <span className="font-medium">{item.name}</span>
          <span className="tabular-nums">{item.rankChange}</span>
        </Link>
      ))}
    </div>
  );
}
