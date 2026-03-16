import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/format";
import type { ProviderSignalSummary } from "@/lib/news/provider-signals";

interface ProviderSignalBadgeProps {
  signal: ProviderSignalSummary;
}

const TONE_BY_SIGNAL: Record<string, string> = {
  launch: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  pricing: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  benchmark: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200",
  api: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  open_source: "border-lime-500/20 bg-lime-500/10 text-lime-200",
  safety: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  research: "border-sky-500/20 bg-sky-500/10 text-sky-200",
};

export function ProviderSignalBadge({ signal }: ProviderSignalBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        className={`border text-[10px] ${TONE_BY_SIGNAL[signal.signalType] ?? "border-border bg-secondary/40 text-muted-foreground"}`}
        title={signal.title}
      >
        {signal.signalLabel}
      </Badge>
      {signal.publishedAt ? (
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeDate(signal.publishedAt)}
        </span>
      ) : null}
    </div>
  );
}
