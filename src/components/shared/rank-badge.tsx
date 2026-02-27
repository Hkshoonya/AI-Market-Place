import { ArrowUp, ArrowDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRankChange } from "@/lib/format";

interface RankBadgeProps {
  rank: number | null;
  previousRank?: number | null;
  size?: "sm" | "md" | "lg";
}

export function RankBadge({ rank, previousRank, size = "md" }: RankBadgeProps) {
  if (rank == null) return null;

  const change = getRankChange(rank, previousRank ?? null);

  const sizeClasses = {
    sm: "text-xs h-5 min-w-5 px-1",
    md: "text-sm h-6 min-w-6 px-1.5",
    lg: "text-base h-8 min-w-8 px-2",
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md font-bold tabular-nums",
          sizeClasses[size],
          rank <= 3
            ? "bg-neon/20 text-neon"
            : rank <= 10
            ? "bg-secondary text-foreground"
            : "bg-secondary text-muted-foreground"
        )}
      >
        #{rank}
      </span>

      {change.direction === "up" && (
        <span className="flex items-center gap-0.5 text-xs text-gain">
          <ArrowUp className="h-3 w-3" />
          {change.amount}
        </span>
      )}
      {change.direction === "down" && (
        <span className="flex items-center gap-0.5 text-xs text-loss">
          <ArrowDown className="h-3 w-3" />
          {change.amount}
        </span>
      )}
      {change.direction === "same" && previousRank != null && (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
      {change.direction === "new" && (
        <span className="flex items-center gap-0.5 text-xs text-neon">
          <Sparkles className="h-3 w-3" />
          NEW
        </span>
      )}
    </div>
  );
}
