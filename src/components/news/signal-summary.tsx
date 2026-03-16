import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { NewsSignalBucket } from "@/lib/news/presentation";

interface SignalSummaryProps {
  buckets: NewsSignalBucket[];
  emptyLabel?: string;
}

const TONE_BY_IMPORTANCE: Record<string, string> = {
  high: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  medium: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  low: "border-border bg-background/70 text-muted-foreground",
};

export function SignalSummary({
  buckets,
  emptyLabel = "No structured news signals yet.",
}: SignalSummaryProps) {
  if (buckets.length === 0) {
    return (
      <Card className="border-border/50 bg-card/60">
        <CardContent className="p-4 text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {buckets.map((bucket) => (
        <Card key={bucket.type} className="border-border/50 bg-card/60">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {bucket.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{bucket.count}</p>
            </div>
            <Badge className={`border ${TONE_BY_IMPORTANCE[bucket.importance] ?? TONE_BY_IMPORTANCE.low}`}>
              {bucket.importance}
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
