import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { assertUuid } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

// PATCH /api/admin/moderate — admin moderation actions
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-moderate:${ip}`, RATE_LIMITS.write);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Verify admin
  const { data: profile } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action, target_type, target_id, reason } = body;

  if (!action || !target_type || !target_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    assertUuid(target_id, "target_id");
  } catch {
    return NextResponse.json({ error: "Invalid target_id format" }, { status: 400 });
  }

  try {
    switch (`${target_type}:${action}`) {
      // User actions
      case "user:ban": {
        await sb.from("profiles").update({ is_banned: true }).eq("id", target_id);
        const { error: banNotifError } = await sb.from("notifications").insert({
          user_id: target_id,
          type: "system",
          title: "Account suspended",
          message: reason || "Your account has been suspended due to policy violations.",
        });
        if (banNotifError) {
          console.error("Failed to insert ban notification:", banNotifError.message);
        }
        return NextResponse.json({ success: true, message: "User banned" });
      }

      case "user:unban": {
        await sb.from("profiles").update({ is_banned: false }).eq("id", target_id);
        const { error: unbanNotifError } = await sb.from("notifications").insert({
          user_id: target_id,
          type: "system",
          title: "Account reinstated",
          message: "Your account has been reinstated.",
        });
        if (unbanNotifError) {
          console.error("Failed to insert unban notification:", unbanNotifError.message);
        }
        return NextResponse.json({ success: true, message: "User unbanned" });
      }

      // Listing actions
      case "listing:remove": {
        const { data: listing } = await sb
          .from("marketplace_listings")
          .select("seller_id, title")
          .eq("id", target_id)
          .single();

        await sb
          .from("marketplace_listings")
          .update({ status: "archived" })
          .eq("id", target_id);

        if (listing) {
          const { error: listingNotifError } = await sb.from("notifications").insert({
            user_id: listing.seller_id,
            type: "marketplace",
            title: "Listing removed",
            message: reason || `Your listing "${listing.title}" has been removed by an administrator.`,
            link: "/dashboard/seller",
          });
          if (listingNotifError) {
            console.error("Failed to insert listing removal notification:", listingNotifError.message);
          }
        }
        return NextResponse.json({ success: true, message: "Listing archived" });
      }

      case "listing:restore": {
        await sb
          .from("marketplace_listings")
          .update({ status: "active" })
          .eq("id", target_id);
        return NextResponse.json({ success: true, message: "Listing restored" });
      }

      // Review actions
      case "review:remove": {
        await sb.from("marketplace_reviews").delete().eq("id", target_id);
        return NextResponse.json({ success: true, message: "Review deleted" });
      }

      // Comment actions
      case "comment:remove": {
        await sb.from("comments").delete().eq("id", target_id);
        return NextResponse.json({ success: true, message: "Comment deleted" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    console.error("Moderation error:", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
