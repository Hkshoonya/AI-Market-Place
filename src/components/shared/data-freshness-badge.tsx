"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRelativeTime } from "@/lib/format";

interface DataFreshnessBadgeProps {
  label: string;
  timestamp: string | null | undefined;
  detail?: string | null;
}

export function DataFreshnessBadge({
  label,
  timestamp,
  detail,
}: DataFreshnessBadgeProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => {
      setTick((current) => current + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp) return null;

  const formattedDate = formatDate(timestamp);
  const displayRelative = tick >= 0 ? formatRelativeTime(timestamp) : formattedDate;

  const accessibilityLabel = [label, displayRelative, formattedDate, detail]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
      aria-label={accessibilityLabel}
    >
      <Clock3 className="h-3.5 w-3.5 text-neon" aria-hidden="true" />
      <span>{label}</span>
      <Badge variant="secondary" className="text-[10px]" suppressHydrationWarning>
        {displayRelative}
      </Badge>
      <span>{formattedDate}</span>
      {detail ? (
        <span className="text-[10px] uppercase tracking-[0.14em]">{detail}</span>
      ) : null}
    </div>
  );
}
