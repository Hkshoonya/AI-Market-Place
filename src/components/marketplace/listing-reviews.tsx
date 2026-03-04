"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MarketplaceReview, Profile } from "@/types/database";

type ReviewWithProfile = MarketplaceReview & {
  profiles?: Pick<Profile, "display_name" | "avatar_url" | "username"> | null;
};

interface ListingReviewsProps {
  listingId: string;
  listingSlug: string;
}

function StarRating({
  rating,
  onRate,
  interactive = false,
  size = "sm",
}: {
  rating: number;
  onRate?: (rating: number) => void;
  interactive?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          className={cn(
            "transition-colors",
            interactive && "cursor-pointer hover:scale-110"
          )}
          onMouseEnter={() => interactive && setHovered(star)}
          onMouseLeave={() => interactive && setHovered(0)}
          onClick={() => onRate?.(star)}
        >
          <Star
            className={cn(
              sizeClass,
              (hovered || rating) >= star
                ? "fill-warning text-warning"
                : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ListingReviews({ listingId, listingSlug }: ListingReviewsProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [newRating, setNewRating] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      // Two-query approach: marketplace_reviews has no FK to profiles
      const { data: rawData, error: fetchError } = await supabase
        .from("marketplace_reviews")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      let enriched: ReviewWithProfile[] = (rawData ?? []) as unknown as ReviewWithProfile[];
      if (enriched.length > 0) {
        const reviewerIds = [...new Set(enriched.map((r) => r.reviewer_id).filter(Boolean))];
        if (reviewerIds.length > 0) {
          const { data: profilesRaw } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, username")
            .in("id", reviewerIds);
          type ReviewProfileRow = { id: string; display_name: string | null; avatar_url: string | null; username: string | null };
          const profiles = (profilesRaw ?? []) as unknown as ReviewProfileRow[];
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          enriched = enriched.map((r) => ({
            ...r,
            profiles: r.reviewer_id ? (profileMap.get(r.reviewer_id) ?? null) : null,
          })) as ReviewWithProfile[];
        }
      }

      setReviews(enriched);
    } catch {
      console.error("Failed to fetch reviews");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newRating === 0) {
      setError("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/marketplace/listings/${listingSlug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: newRating,
          title: newTitle || null,
          content: newContent || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      setSuccess("Review submitted successfully!");
      setNewRating(0);
      setNewTitle("");
      setNewContent("");
      setShowForm(false);
      await fetchReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          Reviews ({reviews.length})
        </CardTitle>
        {user && !showForm && (
          <Button
            size="sm"
            className="bg-neon text-background font-semibold hover:bg-neon/90"
            onClick={() => setShowForm(true)}
          >
            Write a Review
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Review Form */}
        {showForm && user && (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border/50 bg-secondary/30 p-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Your Rating</label>
              <StarRating rating={newRating} onRate={setNewRating} interactive size="md" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Title (optional)</label>
              <Input
                placeholder="Summarize your experience..."
                className="bg-secondary"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Review (optional)</label>
              <textarea
                placeholder="Share your detailed experience with this listing..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-neon">{success}</p>}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={submitting}
                className="bg-neon text-background font-semibold hover:bg-neon/90"
              >
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Login prompt */}
        {!user && (
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              <Link href="/login" className="text-neon hover:underline">
                Sign in
              </Link>{" "}
              to write a review.
            </p>
          </div>
        )}

        {/* Reviews List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-secondary" />
                  <div className="h-4 w-24 rounded bg-secondary" />
                </div>
                <div className="h-3 w-3/4 rounded bg-secondary" />
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No reviews yet. Be the first to review this listing!
          </p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const displayName = review.profiles?.display_name || "Anonymous";
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <div
                  key={review.id}
                  className="rounded-lg border border-border/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      {review.profiles?.avatar_url && (
                        <AvatarImage src={review.profiles.avatar_url} alt={displayName} />
                      )}
                      <AvatarFallback>{initial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{displayName}</span>
                        {review.is_verified_purchase && (
                          <span className="text-[10px] text-neon font-medium">Verified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(review.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="mt-2 text-sm font-semibold">{review.title}</h4>
                  )}
                  {review.content && (
                    <p className="mt-1 text-sm text-muted-foreground">{review.content}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
