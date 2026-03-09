"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Eye } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SWR_TIERS } from "@/lib/swr/config";
import { WatchlistCard } from "@/components/watchlists/watchlist-card";
import { CreateWatchlistDialog } from "@/components/watchlists/create-watchlist-dialog";

interface WatchlistData {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  watchlist_items: {
    model_id: string;
    models?: { name: string; provider: string; slug: string };
  }[];
}

interface WatchlistsResponse {
  data: WatchlistData[];
}

export default function WatchlistsContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR<WatchlistsResponse>(
    user ? "/api/watchlists" : null,
    { ...SWR_TIERS.MEDIUM }
  );

  const watchlists = data?.data ?? [];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/watchlists");
    }
  }, [user, authLoading, router]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/watchlists/${id}`, { method: "DELETE" });
      if (res.ok) {
        mutate();
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Eye className="h-6 w-6 text-neon" />
          <h1 className="text-2xl font-bold">Your Watchlists</h1>
        </div>
        <CreateWatchlistDialog
          onCreated={() => mutate()}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl bg-secondary"
            />
          ))}
        </div>
      ) : watchlists.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {watchlists.map((wl) => (
            <WatchlistCard
              key={wl.id}
              watchlist={wl}
              onDelete={handleDelete}
              deleting={deletingId === wl.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/30 py-16 text-center">
          <Eye className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold">No watchlists yet</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Create watchlists to track your favorite AI models and get
            personalized activity updates.
          </p>
          <div className="mt-6">
            <CreateWatchlistDialog
              onCreated={() => mutate()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
