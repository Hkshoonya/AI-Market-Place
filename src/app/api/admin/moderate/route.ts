import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUuid } from "@/lib/utils/sanitize";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";
import { hasTrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// PATCH /api/admin/moderate — admin moderation actions
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-moderate:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    if (!hasTrustedRequestOrigin(request)) {
      return NextResponse.json(
        { error: "Cross-origin request rejected." },
        { status: 403 }
      );
    }

    const session = await requireAdminSession();
    if (session.error) return session.error;

    const adminSupabase = createAdminClient();

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
        if (target_id === session.user.id) {
          return NextResponse.json(
            { error: "You cannot suspend your own account." },
            { status: 400 }
          );
        }

        const { data: target, error: targetError } = await adminSupabase
          .from("profiles")
          .select("id")
          .eq("id", target_id)
          .single();
        if (targetError || !target) {
          return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const { error: authBanError } =
          await adminSupabase.auth.admin.updateUserById(target_id, {
            ban_duration: "876000h",
          });
        if (authBanError) {
          return NextResponse.json(
            { error: "Could not suspend authentication for this user." },
            { status: 500 }
          );
        }

        const { error: banError } = await adminSupabase
          .from("profiles")
          .update({ is_banned: true, updated_at: new Date().toISOString() })
          .eq("id", target_id);
        if (banError) {
          await adminSupabase.auth.admin.updateUserById(target_id, {
            ban_duration: "none",
          });
          return NextResponse.json(
            { error: "Could not update the suspended user's profile." },
            { status: 500 }
          );
        }

        const { error: banNotifError } = await adminSupabase.from("notifications").insert({
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
        const { data: target, error: targetError } = await adminSupabase
          .from("profiles")
          .select("id")
          .eq("id", target_id)
          .single();
        if (targetError || !target) {
          return NextResponse.json({ error: "User not found." }, { status: 404 });
        }

        const { error: authUnbanError } =
          await adminSupabase.auth.admin.updateUserById(target_id, {
            ban_duration: "none",
          });
        if (authUnbanError) {
          return NextResponse.json(
            { error: "Could not restore authentication for this user." },
            { status: 500 }
          );
        }

        const { error: unbanError } = await adminSupabase
          .from("profiles")
          .update({ is_banned: false, updated_at: new Date().toISOString() })
          .eq("id", target_id);
        if (unbanError) {
          await adminSupabase.auth.admin.updateUserById(target_id, {
            ban_duration: "876000h",
          });
          return NextResponse.json(
            { error: "Could not update the restored user's profile." },
            { status: 500 }
          );
        }

        const { error: unbanNotifError } = await adminSupabase.from("notifications").insert({
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
        const { data: listing, error: listingError } = await adminSupabase
          .from("marketplace_listings")
          .select("seller_id, title")
          .eq("id", target_id)
          .single();
        if (listingError) {
          return NextResponse.json({ error: listingError.message }, { status: 500 });
        }

        const { error: archiveError } = await adminSupabase
          .from("marketplace_listings")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", target_id);
        if (archiveError) {
          return NextResponse.json({ error: archiveError.message }, { status: 500 });
        }

        if (listing) {
          const { error: listingNotifError } = await adminSupabase.from("notifications").insert({
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
        const { error } = await adminSupabase
          .from("marketplace_listings")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", target_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Listing restored" });
      }

      // Review actions
      case "review:remove": {
        const { error } = await adminSupabase
          .from("marketplace_reviews")
          .delete()
          .eq("id", target_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Review deleted" });
      }

      // Comment actions
      case "comment:remove": {
        const { error } = await adminSupabase.from("comments").delete().eq("id", target_id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: "Comment deleted" });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return handleApiError(err, "api/admin/moderate");
  }
}
