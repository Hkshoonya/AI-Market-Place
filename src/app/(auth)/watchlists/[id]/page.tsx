"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Edit3, Eye, Globe, Lock, Save, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/auth-provider";
import { WatchlistModelTable } from "@/components/watchlists/watchlist-model-table";

interface WatchlistModel {
  id: string;
  name: string;
  provider: string;
  slug: string;
  category: string;
  overall_rank: number | null;
  quality_score: number | null;
  hf_downloads: number;
  hf_likes: number;
  release_date: string | null;
  parameter_count: number | null;
  context_window: number | null;
  is_open_weights: boolean;
}

interface WatchlistDetail {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  watchlist_items: {
    id: string;
    model_id: string;
    added_at: string;
    models: WatchlistModel | null;
  }[];
}

export default function WatchlistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const watchlistId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [watchlist, setWatchlist] = useState<WatchlistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchWatchlist = async () => {
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setWatchlist(json.data);
      } else {
        // Not found or unauthorized
        router.push("/watchlists");
      }
    } catch {
      router.push("/watchlists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchWatchlist();
    }
  }, [authLoading, watchlistId]);

  const isOwner = user && watchlist && user.id === watchlist.user_id;

  const handleSave = async () => {
    if (!isOwner) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDesc.trim() || null,
        }),
      });
      if (res.ok) {
        await fetchWatchlist();
        setEditing(false);
        setToast("Watchlist updated");
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublic = async () => {
    if (!isOwner || !watchlist) return;
    try {
      await fetch(`/api/watchlists/${watchlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !watchlist.is_public }),
      });
      await fetchWatchlist();
      setToast(
        watchlist.is_public
          ? "Watchlist is now private"
          : "Watchlist is now public"
      );
    } catch {
      // ignore
    }
  };

  const handleRemoveModel = async (modelId: string) => {
    if (!isOwner) return;
    setRemovingId(modelId);
    try {
      await fetch(
        `/api/watchlists/${watchlistId}/items?model_id=${modelId}`,
        { method: "DELETE" }
      );
      await fetchWatchlist();
      setToast("Model removed from watchlist");
    } catch {
      // ignore
    } finally {
      setRemovingId(null);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      const res = await fetch(`/api/watchlists/${watchlistId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/watchlists");
      }
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    if (!watchlist?.is_public) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/watchlists/${watchlistId}`
      );
      setToast("Link copied to clipboard");
    } catch {
      // ignore
    }
  };

  const handleExportCSV = () => {
    if (!watchlist?.watchlist_items?.length) return;
    const headers = ["Name", "Provider", "Category", "Rank", "Quality Score", "Downloads", "Likes"];
    const rows = watchlist.watchlist_items
      .filter((item: WatchlistDetail["watchlist_items"][0]) => item.models != null)
      .map((item: WatchlistDetail["watchlist_items"][0]) => {
        const m = item.models!;
        return [
          m.name ?? "",
          m.provider ?? "",
          m.category ?? "",
          m.overall_rank ?? "",
          m.quality_score ?? "",
          m.hf_downloads ?? "",
          m.hf_likes ?? "",
        ].join(",");
      });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${watchlist.name.replace(/[^a-zA-Z0-9]/g, "_")}_watchlist.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("Watchlist exported as CSV");
  };

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-secondary" />
          <div className="h-10 w-72 rounded bg-secondary" />
          <div className="h-96 rounded-xl bg-secondary" />
        </div>
      </div>
    );
  }

  if (!watchlist) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/watchlists"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All Watchlists
      </Link>

      {/* Header */}
      <div className="mb-8">
        {editing ? (
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-secondary text-lg font-bold"
              placeholder="Watchlist name"
            />
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-md border border-border/50 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon/30"
              placeholder="Description (optional)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="gap-2 bg-neon text-background font-semibold hover:bg-neon/90"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-neon" />
                  <h1 className="text-2xl font-bold">{watchlist.name}</h1>
                  {watchlist.is_public ? (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {watchlist.description && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {watchlist.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {watchlist.watchlist_items?.length ?? 0} models
                </p>
              </div>

              {isOwner && (
                <div className="flex gap-2">
                  {watchlist.watchlist_items?.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleExportCSV}
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  )}
                  {watchlist.is_public && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleShare}
                    >
                      <Share2 className="h-4 w-4" />
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleTogglePublic}
                  >
                    {watchlist.is_public ? (
                      <>
                        <Lock className="h-4 w-4" />
                        Make Private
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4" />
                        Make Public
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setEditName(watchlist.name);
                      setEditDesc(watchlist.description ?? "");
                      setEditing(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-loss hover:text-loss"
                    onClick={handleDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Models Table */}
      <WatchlistModelTable
        items={watchlist.watchlist_items ?? []}
        onRemove={isOwner ? handleRemoveModel : undefined}
        removingId={removingId}
        isOwner={!!isOwner}
      />

      {/* Compare CTA */}
      {watchlist.watchlist_items?.length >= 2 && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="gap-2" asChild>
            <Link
              href={`/compare?models=${watchlist.watchlist_items
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .slice(0, 5)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((item: any) => item.models?.slug)
                .filter(Boolean)
                .join(",")}`}
            >
              Compare models in this watchlist
            </Link>
          </Button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-slide-up">
          <div className="rounded-lg border border-border/50 bg-card px-4 py-2 text-sm shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
