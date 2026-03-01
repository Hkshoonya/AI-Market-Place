import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// POST /api/auth/delete-account — soft-delete user account
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`delete-account:${ip}`, RATE_LIMITS.auth);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { confirmation } = body;

  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  try {
    // Delete user data in order (respecting foreign keys)
    // 1. Delete order messages
    await sb.from("order_messages").delete().eq("sender_id", user.id);

    // 2. Delete notifications
    await sb.from("notifications").delete().eq("user_id", user.id);
    await sb.from("notification_preferences").delete().eq("user_id", user.id);

    // 3. Delete marketplace orders
    await sb.from("marketplace_orders").delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    // 4. Delete marketplace reviews
    await sb.from("marketplace_reviews").delete().eq("reviewer_id", user.id);

    // 5. Delete marketplace listings
    await sb.from("marketplace_listings").delete().eq("seller_id", user.id);

    // 6. Delete verification requests
    await sb.from("seller_verification_requests").delete().eq("user_id", user.id);

    // 7. Delete watchlist items (via watchlists)
    const { data: watchlists } = await sb
      .from("watchlists")
      .select("id")
      .eq("user_id", user.id);

    if (watchlists && watchlists.length > 0) {
      const watchlistIds = watchlists.map((w: { id: string }) => w.id);
      for (const wid of watchlistIds) {
        await sb.from("watchlist_items").delete().eq("watchlist_id", wid);
      }
    }

    // 8. Delete watchlists
    await sb.from("watchlists").delete().eq("user_id", user.id);

    // 9. Delete bookmarks, ratings, comments
    await sb.from("user_bookmarks").delete().eq("user_id", user.id);
    await sb.from("user_ratings").delete().eq("user_id", user.id);
    await sb.from("comments").delete().eq("user_id", user.id);

    // 10. Anonymize profile (keep the row for referential integrity but clear PII)
    await sb
      .from("profiles")
      .update({
        display_name: "Deleted User",
        username: null,
        avatar_url: null,
        bio: null,
        seller_bio: null,
        seller_website: null,
        is_seller: false,
        seller_verified: false,
        is_admin: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // 11. Sign out the user
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion error:", err);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 }
    );
  }
}
