import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import type { VerificationStatus, SellerVerificationRequest } from "@/types/database";
import { handleApiError } from "@/lib/api-error";
import { systemLog } from "@/lib/logging";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// GET /api/admin/verifications — list verification requests
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-verifications:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const rawStatus = searchParams.get("status") || "pending";
    const validStatuses: VerificationStatus[] = ["pending", "approved", "rejected"];
    const status = validStatuses.includes(rawStatus as VerificationStatus)
      ? (rawStatus as VerificationStatus)
      : "pending";

    // Two-query approach: seller_verification_requests may not have FK to profiles
    const { data: rawData, error } = await adminSupabase
      .from("seller_verification_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: status === "pending" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with user profiles
    // Cast: select("*") on seller_verification_requests may infer {} in some SDK versions
    type VerReqWithProfile = SellerVerificationRequest & { profiles: Record<string, unknown> | null };
    let data: VerReqWithProfile[] = (rawData ?? []) as VerReqWithProfile[];
    if (data.length > 0) {
      const userIds = [...new Set(data.map((r) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, email, is_seller, seller_verified")
          .in("id", userIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
        data = data.map((r) => ({
          ...r,
          profiles: r.user_id ? profileMap.get(r.user_id) ?? null : null,
        }));
      }
    }

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/admin/verifications");
  }
}

// PATCH /api/admin/verifications — approve or reject a request
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-verifications-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    const body = await request.json();
    const { request_id, action, admin_notes } = body as { request_id: string; action: string; admin_notes?: string };

    if (!request_id || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Get the request
    const { data: verReq } = await adminSupabase
      .from("seller_verification_requests")
      .select("user_id, status")
      .eq("id", request_id)
      .single();

    if (!verReq || verReq.status !== "pending") {
      return NextResponse.json({ error: "Request not found or already processed." }, { status: 404 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update the request
    const { error: updateError } = await adminSupabase
      .from("seller_verification_requests")
      .update({
        status: newStatus,
        admin_notes: admin_notes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If approved, update the user's profile
    if (action === "approve") {
      const { error: profileError } = await adminSupabase
        .from("profiles")
        .update({
          seller_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", verReq.user_id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }

      // Create notification for the user (non-critical, log errors only)
      const { error: notifError } = await adminSupabase.from("notifications").insert({
        user_id: verReq.user_id,
        type: "system",
        title: "Seller verification approved!",
        message: "Congratulations! Your seller account has been verified. You now have a verified badge.",
        link: "/dashboard/seller",
      });
      if (notifError) {
        void systemLog.warn("api/admin/verifications", "Failed to insert approval notification", { error: notifError.message });
      }
    } else {
      // Rejected notification (non-critical, log errors only)
      const { error: notifError } = await adminSupabase.from("notifications").insert({
        user_id: verReq.user_id,
        type: "system",
        title: "Seller verification update",
        message: admin_notes || "Your seller verification request was not approved at this time.",
        link: "/dashboard/seller",
      });
      if (notifError) {
        void systemLog.warn("api/admin/verifications", "Failed to insert rejection notification", { error: notifError.message });
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err) {
    return handleApiError(err, "api/admin/verifications");
  }
}
