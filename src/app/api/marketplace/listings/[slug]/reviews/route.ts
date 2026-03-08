import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { z } from "zod";
import { parseQueryResult } from "@/lib/schemas/parse";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

const createReviewSchema = z.object({
  rating: z.number().int("Rating must be a whole number").min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  title: z.string().max(200, "Title must be 200 characters or less").optional().nullable(),
  content: z.string().max(5000, "Content must be 5000 characters or less").optional().nullable(),
});

export const dynamic = "force-dynamic";

// Standalone flat type — avoids intersection conflict with MarketplaceReview.profiles optional field
type ReviewWithProfile = {
  id: string;
  listing_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
  profiles: Record<string, unknown> | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const ip = getClientIp(request);
  const rl = rateLimit(`reviews:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { slug } = await params;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Get listing ID from slug
  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  // Two-query approach: marketplace_reviews may not have FK to profiles
  const ReviewSchema = z.object({
    id: z.string(),
    listing_id: z.string(),
    reviewer_id: z.string(),
    rating: z.number(),
    title: z.string().nullable(),
    content: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  });
  const reviewsResponse = await supabase
    .from("marketplace_reviews")
    .select("*")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  if (reviewsResponse.error) {
    return NextResponse.json(
      { error: "Failed to fetch reviews. Please try again later." },
      { status: 500 }
    );
  }

  // Enrich with reviewer profiles
  let data: ReviewWithProfile[] = parseQueryResult(reviewsResponse, ReviewSchema, "ListingReviews").map(r => ({ ...r, profiles: null }));
  if (data.length > 0) {
    const reviewerIds = [...new Set(data.map((r) => r.reviewer_id).filter(Boolean))];
    if (reviewerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", reviewerIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      data = data.map((r) => ({
        ...r,
        profiles: r.reviewer_id ? profileMap.get(r.reviewer_id) ?? null : null,
      }));
    }
  }

  return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/reviews");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
  const { slug } = await params;
  const { createClient: createServerClient } = await import(
    "@/lib/supabase/server"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to leave a review." },
      { status: 401 }
    );
  }

  const rl = rateLimit(`review-create:${user.id}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = createReviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { rating, title, content } = parsed.data;

  // Get listing ID
  const { data: listing } = await supabase
    .from("marketplace_listings")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("marketplace_reviews")
    .insert({
      listing_id: listing.id,
      reviewer_id: user.id,
      rating,
      title: title || null,
      content: content || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already reviewed this listing" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to submit review. Please try again later." },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "api/marketplace/listings/reviews");
  }
}
