import Link from "next/link";
import { ArrowRight, ExternalLink, RadioTower } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeDate } from "@/lib/format";
import type { LaunchRadarItem } from "@/lib/news/presentation";

interface LaunchRadarProps {
  items: LaunchRadarItem[];
  title?: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

const TONE_BY_SIGNAL: Record<string, string> = {
  launch: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  pricing: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  benchmark: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200",
  api: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  open_source: "border-lime-500/20 bg-lime-500/10 text-lime-200",
  safety: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  research: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  general: "border-border bg-background/60 text-muted-foreground",
};

export function LaunchRadar({
  items,
  title = "Launch Radar",
  description = "Structured signals from provider blogs and X announcements, prioritized by launch, pricing, benchmark, and API impact.",
  ctaHref,
  ctaLabel,
}: LaunchRadarProps) {
  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RadioTower className="h-4 w-4 text-neon" />
            {title}
          </CardTitle>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
        </div>
        {ctaHref && ctaLabel ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1 text-sm text-neon hover:underline"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No launch signals have synced yet.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-border/50 bg-background/40 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border capitalize ${TONE_BY_SIGNAL[item.signalType] ?? TONE_BY_SIGNAL.general}`}>
                    {item.signalType === "api" ? "API" : item.signalLabel}
                  </Badge>
                  {item.related_provider ? (
                    <Badge variant="outline">{item.related_provider}</Badge>
                  ) : null}
                  {item.published_at ? (
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(item.published_at)}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-6">{item.title}</h3>
                {item.summary && item.summary !== item.title ? (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {item.summary}
                  </p>
                ) : null}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-neon hover:underline"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
