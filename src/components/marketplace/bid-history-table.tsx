"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Bid } from "@/types/auction";

export function BidHistoryTable({ bids }: { bids: Bid[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayBids = expanded ? bids : bids.slice(0, 5);

  if (bids.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No bids yet. Be the first to bid!
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30 text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Bidder</th>
              <th className="pb-2 pr-4 font-medium">Amount</th>
              <th className="pb-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {displayBids.map((bid, i) => (
              <tr
                key={bid.id}
                className={cn(
                  "border-b border-border/20",
                  i === 0 && "bg-emerald-500/5"
                )}
              >
                <td className="py-2.5 pr-4">
                  <span className="font-medium">
                    {bid.bidder?.display_name || "Anonymous"}
                  </span>
                  {i === 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] border-emerald-500/30 text-emerald-400"
                    >
                      Highest
                    </Badge>
                  )}
                </td>
                <td className="py-2.5 pr-4 font-semibold text-emerald-400">
                  {formatCurrency(bid.amount)}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {formatDate(bid.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bids.length > 5 && (
        <button
          className="mt-3 flex items-center gap-1 text-xs text-neon hover:text-neon/80 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show all ${bids.length} bids`}
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
      )}
    </div>
  );
}
