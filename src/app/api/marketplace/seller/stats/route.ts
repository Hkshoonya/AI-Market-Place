import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`seller-stats:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required. Please sign in to view seller stats." },
      { status: 401 }
    );
  }

  // Get listing stats
  const { data: listings } = await (supabase as any)
    .from("marketplace_listings")
    .select("id, status, view_count, inquiry_count, avg_rating, review_count")
    .eq("seller_id", user.id);

  const activeListings =
    listings?.filter((l: any) => l.status === "active").length || 0;
  const totalListings = listings?.length || 0;
  const totalViews =
    listings?.reduce(
      (sum: number, l: any) => sum + (l.view_count || 0),
      0
    ) || 0;
  const totalInquiries =
    listings?.reduce(
      (sum: number, l: any) => sum + (l.inquiry_count || 0),
      0
    ) || 0;
  const ratingsArr =
    listings
      ?.filter((l: any) => l.avg_rating != null)
      .map((l: any) => l.avg_rating) || [];
  const avgRating =
    ratingsArr.length > 0
      ? ratingsArr.reduce((a: number, b: number) => a + b, 0) /
        ratingsArr.length
      : null;

  // Get pending orders count
  const { count: pendingOrders } = await (supabase as any)
    .from("marketplace_orders")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({
    totalListings,
    activeListings,
    totalViews,
    totalInquiries,
    avgRating: avgRating ? Number(avgRating.toFixed(2)) : null,
    pendingOrders: pendingOrders || 0,
  });
}
