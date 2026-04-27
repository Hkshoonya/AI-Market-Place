import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// GET /api/notifications/preferences
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`notif-prefs:${ip}`, RATE_LIMITS.public);
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

    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Return defaults if no preferences exist yet
    const defaults = {
      email_model_updates: true,
      email_watchlist_changes: true,
      email_order_updates: true,
      email_marketplace: false,
      email_newsletter: true,
      in_app_model_updates: true,
      in_app_watchlist_changes: true,
      in_app_order_updates: true,
      in_app_marketplace: true,
    };

    return NextResponse.json({ data: data ?? defaults });
  } catch (err) {
    return handleApiError(err, "api/notifications/preferences");
  }
}

// PUT /api/notifications/preferences
export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`notif-prefs-write:${ip}`, RATE_LIMITS.write);
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

    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) {
      return originError;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // Allowed fields
    const allowed = [
      "email_model_updates",
      "email_watchlist_changes",
      "email_order_updates",
      "email_marketplace",
      "email_newsletter",
      "in_app_model_updates",
      "in_app_watchlist_changes",
      "in_app_order_updates",
      "in_app_marketplace",
    ];

    const updates: Record<string, boolean> = {};
    const bodyRecord = body as Record<string, unknown>;
    for (const key of allowed) {
      if (typeof bodyRecord[key] === "boolean") {
        updates[key] = bodyRecord[key] as boolean;
      }
    }

    // Upsert preferences
    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(
        { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/notifications/preferences");
  }
}
