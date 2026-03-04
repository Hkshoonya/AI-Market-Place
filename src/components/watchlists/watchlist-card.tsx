"use client";

import Link from "next/link";
import { Eye, Globe, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WatchlistCardProps {
  watchlist: {
    id: string;
    name: string;
    description: string | null;
    is_public: boolean;
    created_at: string;
    updated_at: string;
    watchlist_items?: { model_id: string; models?: { name: string; provider: string; slug: string } }[];
  };
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export function WatchlistCard({ watchlist, onDelete, deleting }: WatchlistCardProps) {
  const itemCount = watchlist.watchlist_items?.length ?? 0;
  const previewModels = (watchlist.watchlist_items ?? [])
    .slice(0, 5)
    .map((item) => item.models)
    .filter((m): m is NonNullable<typeof m> => m != null);

  return (
    <div className="group rounded-xl border border-border/50 bg-card p-5 transition-all hover:border-neon/20 hover:shadow-lg hover:shadow-neon/5">
      <div className="flex items-start justify-between">
        <Link
          href={`/watchlists/${watchlist.id}`}
          className="flex-1"
        >
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-neon" />
            <h3 className="font-semibold group-hover:text-neon transition-colors">
              {watchlist.name}
            </h3>
            {watchlist.is_public ? (
              <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-label="Public watchlist" />
            ) : (
              <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-label="Private watchlist" />
            )}
          </div>

          {watchlist.description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
              {watchlist.description}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className={cn("font-medium", itemCount > 0 && "text-foreground")}>
              {itemCount} {itemCount === 1 ? "model" : "models"}
            </span>
          </div>

          {previewModels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {previewModels.map((m, i: number) => (
                <span
                  key={i}
                  className="inline-flex rounded-md bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {m.name}
                </span>
              ))}
              {itemCount > 5 && (
                <span className="inline-flex rounded-md bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground">
                  +{itemCount - 5} more
                </span>
              )}
            </div>
          )}
        </Link>

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              onDelete(watchlist.id);
            }}
            disabled={deleting}
            aria-label={`Delete watchlist ${watchlist.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
