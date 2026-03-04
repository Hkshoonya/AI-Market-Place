"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { CreateWatchlistDialog } from "./create-watchlist-dialog";

interface WatchlistSummary {
  id: string;
  name: string;
  watchlist_items: { model_id: string }[];
}

interface AddToWatchlistProps {
  modelId: string;
  modelName: string;
}

export function AddToWatchlist({ modelId, modelName }: AddToWatchlistProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchWatchlists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlists");
      const json = await res.json();
      if (res.ok && json.data) {
        setWatchlists(
          (json.data as Array<{ id: string; name: string; watchlist_items?: { model_id: string }[] }>).map((w) => ({
            id: w.id,
            name: w.name,
            watchlist_items: w.watchlist_items ?? [],
          }))
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchWatchlists();
    }
  };

  const isInWatchlist = (wl: WatchlistSummary) =>
    wl.watchlist_items.some((item: { model_id: string; models?: { id: string } }) => {
      const mid = item.model_id ?? item.models?.id;
      return mid === modelId;
    });

  const toggleItem = async (watchlistId: string, isCurrentlyIn: boolean) => {
    setTogglingId(watchlistId);
    try {
      if (isCurrentlyIn) {
        await fetch(
          `/api/watchlists/${watchlistId}/items?model_id=${modelId}`,
          { method: "DELETE" }
        );
        setToast(`Removed from watchlist`);
      } else {
        await fetch(`/api/watchlists/${watchlistId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_id: modelId }),
        });
        setToast(`Added to watchlist`);
      }
      // Refresh
      await fetchWatchlists();
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="h-4 w-4" />
            Watch
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Watchlist</DialogTitle>
            <DialogDescription>
              Add <span className="font-medium text-foreground">{modelName}</span> to one of your watchlists.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-secondary"
                  />
                ))}
              </div>
            ) : watchlists.length > 0 ? (
              watchlists.map((wl) => {
                const inList = isInWatchlist(wl);
                return (
                  <button
                    key={wl.id}
                    onClick={() => toggleItem(wl.id, inList)}
                    disabled={togglingId === wl.id}
                    className="flex w-full items-center justify-between rounded-lg border border-border/30 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/50 disabled:opacity-50"
                  >
                    <span className="font-medium">{wl.name}</span>
                    <span className="flex items-center gap-1.5 text-xs">
                      {togglingId === wl.id ? (
                        <span className="text-muted-foreground">...</span>
                      ) : inList ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-neon" />
                          <span className="text-neon">Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Add</span>
                        </>
                      )}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No watchlists yet. Create one to get started!
              </p>
            )}

            <div className="border-t border-border/30 pt-3">
              <CreateWatchlistDialog
                onCreated={() => fetchWatchlists()}
                trigger={
                  <button className="flex w-full items-center gap-2 rounded-lg px-4 py-2.5 text-left text-sm text-neon transition-colors hover:bg-neon/5">
                    <Plus className="h-4 w-4" />
                    Create new watchlist
                  </button>
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-2 text-sm shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
