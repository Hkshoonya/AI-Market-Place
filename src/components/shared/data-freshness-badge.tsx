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
  if (!timestamp) return null;

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-border/50 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">
      <Clock3 className="h-3.5 w-3.5 text-neon" />
      <span>{label}</span>
      <Badge variant="secondary" className="text-[10px]">
        {formatRelativeTime(timestamp)}
      </Badge>
      <span>{formatDate(timestamp)}</span>
      {detail ? (
        <span className="text-[10px] uppercase tracking-[0.14em]">{detail}</span>
      ) : null}
    </div>
  );
}
