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

  type ListingStat = {
    id: string;
    status: string;
    view_count: number | null;
    inquiry_count: number | null;
    avg_rating: number | null;
    review_count: number | null;
  };

  // Get listing stats
  const { data: rawListings } = await supabase
    .from("marketplace_listings")
    .select("id, status, view_count, inquiry_count, avg_rating, review_count")
    .eq("seller_id", user.id);

  const listings = (rawListings ?? []) as ListingStat[];

  const activeListings = listings.filter((l) => l.status === "active").length;
  const totalListings = listings.length;
  const totalViews = listings.reduce((sum, l) => sum + (l.view_count || 0), 0);
  const totalInquiries = listings.reduce(
    (sum, l) => sum + (l.inquiry_count || 0),
    0
  );
  const ratingsArr = listings
    .filter((l) => l.avg_rating != null)
    .map((l) => l.avg_rating as number);
  const avgRating =
    ratingsArr.length > 0
      ? ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length
      : null;

  // Get pending orders count
  const { count: pendingOrders } = await supabase
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
