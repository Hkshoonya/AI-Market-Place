import { Badge } from "@/components/ui/badge";
import type { BenchmarkTrackingSummary } from "@/lib/models/benchmark-status";

const BADGE_CLASS_BY_STATUS: Record<BenchmarkTrackingSummary["status"], string> = {
  structured: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  provider_reported: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  arena_only: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  not_standardized: "border-border/60 bg-secondary/40 text-muted-foreground",
};

export function BenchmarkTrackingBadge({
  summary,
  className = "",
}: {
  summary: BenchmarkTrackingSummary | null | undefined;
  className?: string;
}) {
  if (!summary) return null;

  return (
    <Badge
      variant="outline"
      title={summary.summary}
      className={`${BADGE_CLASS_BY_STATUS[summary.status]} text-[10px] ${className}`.trim()}
    >
      {summary.badgeLabel}
    </Badge>
  );
}
