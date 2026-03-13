import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

export const dynamic = "force-dynamic";

// POST /api/auth/delete-account — fully delete user account (anonymize profile + remove auth identity)
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`delete-account:${ip}`, RATE_LIMITS.auth);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const { confirmation } = body as { confirmation: string };

    if (confirmation !== "DELETE") {
      return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });
    }

    // Check for remaining wallet funds
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance, held_balance")
      .eq("owner_id", user.id)
      .eq("owner_type", "user")
      .single();

    if (wallet) {
      const totalFunds = Number(wallet.balance || 0) + Number(wallet.held_balance || 0);
      if (totalFunds > 0) {
        return NextResponse.json(
          {
            error: `Cannot delete account with remaining funds ($${totalFunds.toFixed(2)}). Please withdraw your balance first.`,
          },
          { status: 400 }
        );
      }
    }

    // Delete user data in order (respecting foreign keys)
    // 1. Delete order messages
    await supabase.from("order_messages").delete().eq("sender_id", user.id);

    // 2. Delete notifications
    await supabase.from("notifications").delete().eq("user_id", user.id);
    await supabase.from("notification_preferences").delete().eq("user_id", user.id);

    // 3. Delete marketplace orders
    await supabase.from("marketplace_orders").delete().or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);

    // 4. Delete marketplace reviews
    await supabase.from("marketplace_reviews").delete().eq("reviewer_id", user.id);

    // 5. Delete marketplace listings
    await supabase.from("marketplace_listings").delete().eq("seller_id", user.id);

    // 6. Delete verification requests
    await supabase.from("seller_verification_requests").delete().eq("user_id", user.id);

    // 7. Delete watchlist items (via watchlists)
    const { data: watchlists } = await supabase
      .from("watchlists")
      .select("id")
      .eq("user_id", user.id);

    if (watchlists && watchlists.length > 0) {
      const watchlistIds = watchlists.map((w: { id: string }) => w.id);
      for (const wid of watchlistIds) {
        await supabase.from("watchlist_items").delete().eq("watchlist_id", wid);
      }
    }

    // 8. Delete watchlists
    await supabase.from("watchlists").delete().eq("user_id", user.id);

    // 9. Delete bookmarks, ratings, comments
    await supabase.from("user_bookmarks").delete().eq("user_id", user.id);
    await supabase.from("user_ratings").delete().eq("user_id", user.id);
    await supabase.from("comments").delete().eq("user_id", user.id);

    // 10. Anonymize profile (keep the row for referential integrity but clear PII)
    await supabase
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

    // 11. Sign out the user's session
    await supabase.auth.signOut();

    // 12. Fully delete the auth identity (GDPR compliance)
    // Uses admin client (service role) to remove the user from auth.users
    try {
      const adminClient = createAdminClient();
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteAuthError) {
        void systemLog.warn("api/auth/delete-account", "Failed to delete auth user (profile already anonymized)", {
          error: deleteAuthError.message,
        });
        // Don't fail the request — profile is already anonymized, auth deletion is best-effort
      }
    } catch (authDeleteErr) {
      void systemLog.warn("api/auth/delete-account", "Auth user deletion threw (profile already anonymized)", {
        error: authDeleteErr instanceof Error ? authDeleteErr.message : String(authDeleteErr),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "api/auth/delete-account");
  }
}
