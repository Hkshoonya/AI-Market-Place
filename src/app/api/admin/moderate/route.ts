import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { assertUuid } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";

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

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const { action, target_type, target_id, reason } = body as { action: string; target_type: string; target_id: string; reason?: string };

    if (!action || !target_type || !target_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    try {
      assertUuid(target_id, "target_id");
    } catch {
      return NextResponse.json({ error: "Invalid target_id format" }, { status: 400 });
    }

    switch (`${target_type}:${action}`) {
      // User actions
      case "user:ban": {
        await supabase.from("profiles").update({ is_banned: true }).eq("id", target_id);
        const { error: banNotifError } = await supabase.from("notifications").insert({
          user_id: target_id,
          type: "system",
          title: "Account suspended",
          message: reason || "Your account has been suspended due to policy violations.",
        });
        if (banNotifError) {
          void systemLog.warn("api/admin/moderate", "Failed to insert ban notification", { error: banNotifError.message });
        }
        return NextResponse.json({ success: true, message: "User banned" });
      }

      case "user:unban": {
        await supabase.from("profiles").update({ is_banned: false }).eq("id", target_id);
        const { error: unbanNotifError } = await supabase.from("notifications").insert({
          user_id: target_id,
          type: "system",
          title: "Account reinstated",
          message: "Your account has been reinstated.",
        });
        if (unbanNotifError) {
          void systemLog.warn("api/admin/moderate", "Failed to insert unban notification", { error: unbanNotifError.message });
        }
        return NextResponse.json({ success: true, message: "User unbanned" });
      }

      // Listing actions
      case "listing:remove": {
        const { data: listing } = await supabase
          .from("marketplace_listings")
          .select("seller_id, title")
          .eq("id", target_id)
          .single();

        await supabase
          .from("marketplace_listings")
          .update({ status: "archived" })
          .eq("id", target_id);

        if (listing) {
          const { error: listingNotifError } = await supabase.from("notifications").insert({
            user_id: listing.seller_id,
            type: "marketplace",
            title: "Listing removed",
            message: reason || `Your listing "${listing.title}" has been removed by an administrator.`,
            link: "/dashboard/seller",
          });
          if (listingNotifError) {
            void systemLog.warn("api/admin/moderate", "Failed to insert listing removal notification", { error: listingNotifError.message });
          }
        }
        return NextResponse.json({ success: true, message: "Listing archived" });
      }

      case "listing:restore": {
        await supabase
          .from("marketplace_listings")
          .update({ status: "active" })
          .eq("id", target_id);
        return NextResponse.json({ success: true, message: "Listing restored" });
      }

      // Review actions
      case "review:remove": {
        await supabase.from("marketplace_reviews").delete().eq("id", target_id);
        return NextResponse.json({ success: true, message: "Review deleted" });
      }

      // Comment actions
      case "comment:remove": {
        await supabase.from("comments").delete().eq("id", target_id);
        return NextResponse.json({ success: true, message: "Comment deleted" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return handleApiError(err, "api/admin/moderate");
  }
}
