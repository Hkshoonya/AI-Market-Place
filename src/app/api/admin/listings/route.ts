import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { sanitizeFilterValue } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-listings:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    // Auth + admin check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use admin client to bypass RLS
    const admin = createAdminClient();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");

    let query = admin
      .from("marketplace_listings")
      .select("id, slug, title, listing_type, status, pricing_type, price, avg_rating, review_count, view_count, inquiry_count, is_featured, created_at, seller_id", { count: "exact" });

    if (statusFilter !== "all") query = query.eq("status", statusFilter as import("@/types/database").ListingStatus);
    if (search) {
      const safeSearch = sanitizeFilterValue(search);
      if (safeSearch) query = query.ilike("title", `%${safeSearch}%`);
    }

    query = query.order("created_at", { ascending: false });

    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data: rawData, count } = await query;

    // Enrich with seller profiles
    let enrichedData = rawData ?? [];
    if (enrichedData.length > 0) {
      const sellerIds = [...new Set(enrichedData.map((l) => l.seller_id).filter(Boolean))];
      const listingIds = enrichedData.map((listing) => listing.id);
      if (sellerIds.length > 0) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, display_name, username")
          .in("id", sellerIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        enrichedData = enrichedData.map((l) => ({
          ...l,
          profiles: l.seller_id ? profileMap.get(l.seller_id) ?? null : null,
        }));
      }

      const { data: policyReviews } = await admin
        .from("listing_policy_reviews")
        .select(
          "listing_id, decision, classifier_label, review_status, created_at, content_risk_level, autonomy_risk_level, purchase_mode, autonomy_mode, reason_codes"
        )
        .in("listing_id", listingIds)
        .order("created_at", { ascending: false });

      const reviewMap = new Map<
        string,
        {
          decision: string;
          label: string;
          review_status: string;
          created_at: string;
          content_risk_level: string;
          autonomy_risk_level: string;
          purchase_mode: string;
          autonomy_mode: string;
          reason_codes: string[];
        }
      >();

      for (const review of policyReviews ?? []) {
        if (!reviewMap.has(review.listing_id)) {
          reviewMap.set(review.listing_id, {
            decision: review.decision,
            label: review.classifier_label,
            review_status: review.review_status,
            created_at: review.created_at,
            content_risk_level: review.content_risk_level,
            autonomy_risk_level: review.autonomy_risk_level,
            purchase_mode: review.purchase_mode,
            autonomy_mode: review.autonomy_mode,
            reason_codes: review.reason_codes ?? [],
          });
        }
      }

      enrichedData = enrichedData.map((listing) => ({
        ...listing,
        policy_review: reviewMap.get(listing.id) ?? null,
      }));
    }

    return NextResponse.json({ data: enrichedData, count: count ?? 0 });
  } catch (err) {
    return handleApiError(err, "api/admin/listings");
  }
}
