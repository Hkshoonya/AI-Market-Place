import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/admin/verifications — list verification requests
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-verifications:${ip}`, RATE_LIMITS.public);
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

  // Check admin
  const { data: profile } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const { data, error } = await sb
    .from("seller_verification_requests")
    .select("*, profiles:user_id(id, display_name, username, avatar_url, email, is_seller, seller_verified)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// PATCH /api/admin/verifications — approve or reject a request
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`admin-verifications-write:${ip}`, RATE_LIMITS.write);
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

  // Check admin
  const { data: profile } = await sb
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { request_id, action, admin_notes } = body;

  if (!request_id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Get the request
  const { data: verReq } = await sb
    .from("seller_verification_requests")
    .select("user_id, status")
    .eq("id", request_id)
    .single();

  if (!verReq || verReq.status !== "pending") {
    return NextResponse.json({ error: "Request not found or already processed." }, { status: 404 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";

  // Update the request
  const { error: updateError } = await sb
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
    await sb
      .from("profiles")
      .update({
        seller_verified: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", verReq.user_id);

    // Create notification for the user (non-critical, log errors only)
    const { error: notifError } = await sb.from("notifications").insert({
      user_id: verReq.user_id,
      type: "system",
      title: "Seller verification approved!",
      message: "Congratulations! Your seller account has been verified. You now have a verified badge.",
      link: "/dashboard/seller",
    });
    if (notifError) {
      console.error("Failed to insert approval notification:", notifError.message);
    }
  } else {
    // Rejected notification (non-critical, log errors only)
    const { error: notifError } = await sb.from("notifications").insert({
      user_id: verReq.user_id,
      type: "system",
      title: "Seller verification update",
      message: admin_notes || "Your seller verification request was not approved at this time.",
      link: "/dashboard/seller",
    });
    if (notifError) {
      console.error("Failed to insert rejection notification:", notifError.message);
    }
  }

  return NextResponse.json({ success: true, status: newStatus });
}
