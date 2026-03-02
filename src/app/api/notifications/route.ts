import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/notifications — list notifications for authenticated user
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`notifications:${ip}`, RATE_LIMITS.public);
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

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Count unread
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: unreadCount } = await (supabase as any)
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  // Sanitize notification links: must be relative paths
  const sanitized = (data ?? []).map((n: any) => ({
    ...n,
    link: n.link && typeof n.link === "string" && n.link.startsWith("/") && !n.link.startsWith("//")
      ? n.link
      : null,
  }));

  return NextResponse.json({ data: sanitized, unreadCount: unreadCount ?? 0 });
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`notifications-write:${ip}`, RATE_LIMITS.write);
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
  const { markAll } = body;

  // Validate ids array if provided
  const idsSchema = z.array(z.string().uuid()).max(100);
  let ids: string[] | undefined;
  if (body.ids) {
    const parsed = idsSchema.safeParse(body.ids);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ids array" }, { status: 400 });
    }
    ids = parsed.data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  if (markAll) {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else if (ids && Array.isArray(ids)) {
    const { error } = await sb
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
