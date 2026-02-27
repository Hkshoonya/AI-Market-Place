"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bell,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/format";

interface ModelUpdate {
  id: string;
  model_id: string;
  update_type: string;
  title: string;
  description: string | null;
  published_at: string;
  models?: {
    id: string;
    slug: string;
    name: string;
    provider: string;
  } | null;
}

interface ActivityFeedProps {
  maxItems?: number;
  compact?: boolean;
}

const UPDATE_TYPE_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; label: string }
> = {
  release: { icon: Zap, color: "text-neon", label: "New Release" },
  update: { icon: RefreshCw, color: "text-blue-400", label: "Update" },
  benchmark: { icon: ArrowUpRight, color: "text-amber-400", label: "Benchmark" },
  pricing: { icon: ArrowUpRight, color: "text-purple-400", label: "Pricing" },
  deprecation: { icon: Bell, color: "text-loss", label: "Deprecated" },
};

export function ActivityFeed({ maxItems = 20, compact = false }: ActivityFeedProps) {
  const [updates, setUpdates] = useState<ModelUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGlobal, setIsGlobal] = useState(false);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch("/api/activity");
        const json = await res.json();
        if (res.ok) {
          setUpdates((json.data ?? []).slice(0, maxItems));
          setIsGlobal(json.isGlobal ?? false);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [maxItems]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-secondary" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-secondary" />
              <div className="h-3 w-1/2 rounded bg-secondary" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className="rounded-xl border border-border/30 py-12 text-center">
        <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">No activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add models to your watchlists to see updates here.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          asChild
        >
          <Link href="/watchlists">Manage Watchlists</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {isGlobal && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing global activity. Add models to your{" "}
          <Link href="/watchlists" className="text-neon hover:underline">
            watchlists
          </Link>{" "}
          for personalized updates.
        </p>
      )}

      {updates.map((update) => {
        const config =
          UPDATE_TYPE_CONFIG[update.update_type] ?? UPDATE_TYPE_CONFIG.update;
        const Icon = config.icon;

        return (
          <div
            key={update.id}
            className="flex gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/30"
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary ${config.color}`}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {!compact && update.models && (
                    <Link
                      href={`/models/${update.models.slug}`}
                      className="text-xs font-medium text-neon hover:underline"
                    >
                      {update.models.name}
                    </Link>
                  )}
                  <p
                    className={`text-sm ${compact ? "line-clamp-1" : "line-clamp-2"}`}
                  >
                    {compact && update.models && (
                      <span className="font-medium text-neon">
                        {update.models.name}{" "}
                      </span>
                    )}
                    {update.title}
                  </p>
                  {!compact && update.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {update.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeDate(update.published_at)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
