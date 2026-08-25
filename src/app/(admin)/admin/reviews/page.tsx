"use client";

import { useDeferredValue, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SWR_TIERS } from "@/lib/swr/config";
import { jsonFetcher } from "@/lib/swr/fetcher";
import { formatRelativeDate } from "@/lib/format";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { MarketplaceReview, Profile, MarketplaceListing } from "@/types/database";

type EnrichedReview = Pick<MarketplaceReview, "id" | "rating" | "title" | "content" | "created_at" | "listing_id" | "reviewer_id"> & {
  profiles?: Pick<Profile, "display_name" | "username"> | null;
  marketplace_listings?: Pick<MarketplaceListing, "id" | "title" | "slug"> | null;
};

interface AdminReviewsData {
  reviews: EnrichedReview[];
  totalCount: number;
}

const PAGE_SIZE = 20;

export default function AdminReviewsPage() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDeferredValue(searchInput.trim());
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({
    page: String(page),
    rating: ratingFilter,
  });
  if (search) query.set("search", search);

  const { data, error, isLoading: loading, mutate } = useSWR<AdminReviewsData>(
    `/api/admin/reviews?${query.toString()}`,
    jsonFetcher<AdminReviewsData>,
    { ...SWR_TIERS.MEDIUM }
  );

  const reviews = data?.reviews ?? [];
  const totalCount = data?.totalCount ?? 0;

  const removeReview = async (id: string) => {
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          target_type: "review",
          target_id: id,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "Request failed");
      toast.success("Review deleted");
      await mutate();
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Failed to delete review"
      );
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-neon" />
          Marketplace Reviews ({totalCount})
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            aria-label="Search reviews"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-secondary"
          />
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {["all", "5", "4", "3", "2", "1"].map((r) => (
            <Button
              key={r}
              variant={ratingFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => { setRatingFilter(r); setPage(1); }}
              className={ratingFilter === r ? "bg-neon text-background hover:bg-neon/90" : ""}
            >
              {r === "all" ? "All" : (
                <span className="flex items-center gap-1">
                  {r} <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card className="border-loss/30 bg-loss/5">
          <CardContent className="flex items-start justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-loss" />
              <div>
                <p className="text-sm font-medium text-loss">Reviews could not load</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown request error"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => void mutate()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-border/30 py-16 text-center">
            <div className="flex flex-col items-center gap-2">
              <Star className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No reviews found</p>
              <p className="text-xs text-muted-foreground/70">
                {search ? "Try adjusting your search or filters" : "Reviews will appear here once submitted"}
              </p>
            </div>
          </div>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border/30 p-4 hover:bg-secondary/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < r.rating ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {r.rating}/5
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(r.created_at)}
                    </span>
                  </div>
                  {r.title && (
                    <p className="text-sm font-medium">{r.title}</p>
                  )}
                  {r.content && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.content}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      By: {r.profiles?.display_name || r.profiles?.username || "Anonymous"}
                    </span>
                    <span>
                      Listing: {r.marketplace_listings?.title || "Unknown"}
                    </span>
                  </div>
                </div>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-loss hover:text-loss shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  }
                  title="Delete Review"
                  description="Are you sure you want to delete this review? This action cannot be undone."
                  confirmLabel="Delete"
                  variant="destructive"
                  onConfirm={() => removeReview(r.id)}
                />
              </div>
            </div>
          ))
        )}
      </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalCount} total)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
