import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/admin/sync — recent sync jobs
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-sync:${ip}`, RATE_LIMITS.public);
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const source = request.nextUrl.searchParams.get("source");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam
      ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50))
      : 50;

    // Build query with optional source filter
    let query = supabase
      .from("sync_jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (source) {
      query = query.eq("source", source);
    }

    const { data, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  } catch (err) {
    return handleApiError(err, "api/admin/sync");
  }
}
