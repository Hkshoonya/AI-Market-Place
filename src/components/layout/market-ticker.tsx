"use client";

import Link from "next/link";
import useSWR from "swr";
import { SWR_TIERS } from "@/lib/swr/config";

interface TickerItem {
  name: string;
  slug: string;
  provider: string;
  score: number | null;
  delta: number | null;
  rank: number | null;
}

export function MarketTicker() {
  const { data: items } = useSWR<TickerItem[]>("/api/charts/ticker", {
    ...SWR_TIERS.FAST,
  });

  const tickerItems = items ?? [];
  if (tickerItems.length === 0) return null;

  // Duplicate for seamless loop
  const doubled = [...tickerItems, ...tickerItems];

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-border/30 overflow-hidden h-8 relative z-20">
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className="flex items-center h-full gap-6 whitespace-nowrap"
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "running"; }}
        style={{
          animation: `ticker-scroll ${tickerItems.length * 3}s linear infinite`,
        }}
      >
        {doubled.map((item, i) => (
          <Link
            key={`${item.slug}-${i}`}
            href={`/models/${item.slug}`}
            className="flex items-center gap-2 text-xs font-mono shrink-0 hover:text-[#00d4aa] transition-colors"
          >
            <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
            <span className="text-white font-semibold tabular-nums">
              {item.score?.toFixed(1) ?? "\u2014"}
            </span>
            {item.delta != null && item.delta !== 0 && (
              <span
                className={`tabular-nums font-semibold ${
                  item.delta > 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {item.delta > 0 ? "\u25B2" : "\u25BC"}
                {Math.abs(item.delta).toFixed(1)}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
