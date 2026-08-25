import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
  getClientIp,
  rateLimit,
  RATE_LIMITS,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-reviews:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const session = await requireAdminSession();
    if (session.error) return session.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
    );
    const rawRating = Number.parseInt(searchParams.get("rating") ?? "", 10);
    const rating = rawRating >= 1 && rawRating <= 5 ? rawRating : null;
    const search = sanitizeFilterValue(searchParams.get("search") ?? "");
    const admin = createAdminClient();

    let query = admin.from("marketplace_reviews").select(
      "id, rating, title, content, created_at, listing_id, reviewer_id",
      { count: "exact" }
    );

    if (rating) query = query.eq("rating", rating);
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`
      );
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data: reviews, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json(
        { error: "Could not load marketplace reviews." },
        { status: 500 }
      );
    }

    const reviewerIds = [
      ...new Set((reviews ?? []).map((review) => review.reviewer_id)),
    ];
    const listingIds = [
      ...new Set((reviews ?? []).map((review) => review.listing_id)),
    ];

    const [profilesResult, listingsResult] = await Promise.all([
      reviewerIds.length > 0
        ? admin
            .from("profiles")
            .select("id, display_name, username")
            .in("id", reviewerIds)
        : Promise.resolve({ data: [], error: null }),
      listingIds.length > 0
        ? admin
            .from("marketplace_listings")
            .select("id, title, slug")
            .in("id", listingIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error || listingsResult.error) {
      return NextResponse.json(
        { error: "Could not enrich marketplace reviews." },
        { status: 500 }
      );
    }

    const profiles = new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile])
    );
    const listings = new Map(
      (listingsResult.data ?? []).map((listing) => [listing.id, listing])
    );

    return NextResponse.json({
      reviews: (reviews ?? []).map((review) => ({
        ...review,
        profiles: profiles.get(review.reviewer_id) ?? null,
        marketplace_listings: listings.get(review.listing_id) ?? null,
      })),
      totalCount: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/reviews");
  }
}
