import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/watchlists/[id] — get a single watchlist with items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`watchlist-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the watchlist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: watchlist, error } = await (supabase as any)
    .from("watchlists")
    .select(
      "*, watchlist_items(id, model_id, added_at, models(id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, hf_likes, release_date, parameter_count, context_window, is_open_weights))"
    )
    .eq("id", id)
    .single();

  if (error || !watchlist) {
    return NextResponse.json(
      { error: "Watchlist not found" },
      { status: 404 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wl = watchlist as any;

  // Check access: must be owner or watchlist must be public
  if (!wl.is_public && (!user || wl.user_id !== user.id)) {
    return NextResponse.json(
      { error: "Watchlist not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: watchlist });
}

// PATCH /api/watchlists/[id] — update watchlist name/description/visibility
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`watchlist-edit:${user.id}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.is_public !== undefined) updates.is_public = body.is_public;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("watchlists")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Watchlist not found or not owned by you" },
      { status: 404 }
    );
  }

  return NextResponse.json({ data });
}

// DELETE /api/watchlists/[id] — delete a watchlist
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl2 = rateLimit(`watchlist-delete:${user.id}`, RATE_LIMITS.api);
  if (!rl2.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl2) }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("watchlists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
