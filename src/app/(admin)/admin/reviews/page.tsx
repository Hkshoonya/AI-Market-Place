"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 20;
const supabase = createClient();

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("marketplace_reviews")
      .select(
        "id, rating, title, content, created_at, listing_id, marketplace_listings!marketplace_reviews_listing_id_fkey(title, slug), profiles!marketplace_reviews_reviewer_id_fkey(display_name, username)",
        { count: "exact" }
      );

    if (ratingFilter !== "all") {
      query = query.eq("rating", parseInt(ratingFilter));
    }
    if (search) {
      const safeSearch = sanitizeFilterValue(search);
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,content.ilike.%${safeSearch}%`);
      }
    }

    query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count } = await query;
    setReviews((data as any[]) ?? []);
    setTotalCount(count ?? 0);
    setLoading(false);
  }, [search, ratingFilter, page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const removeReview = async (id: string) => {
    if (!confirm("Delete this review permanently?")) return;
    await fetch("/api/admin/moderate", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove",
        target_type: "review",
        target_id: id,
      }),
    });
    fetchReviews();
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
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-secondary"
          />
        </div>
        <div className="flex gap-1">
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

      {/* Reviews List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary" />
          ))
        ) : reviews.length === 0 ? (
          <div className="rounded-xl border border-border/30 py-12 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">No reviews found.</p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-loss hover:text-loss shrink-0"
                  onClick={() => removeReview(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

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
