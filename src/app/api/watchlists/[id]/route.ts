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

  // Fetch the watchlist with items and models joined.
  // NOTE: Without FK Relationships in the DB type, the embedded join causes the SDK
  // to infer `never` for the result. Cast to the expected shape at runtime.
  type WatchlistWithItems = {
    id: string; user_id: string; name: string; description: string | null;
    is_public: boolean; created_at: string; updated_at: string;
    watchlist_items: Array<{
      id: string; model_id: string; added_at: string;
      models: Record<string, unknown> | null;
    }> | null;
  };
  const { data: watchlist, error } = (await supabase
    .from("watchlists")
    .select(
      "*, watchlist_items(id, model_id, added_at, models(id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, hf_likes, release_date, parameter_count, context_window, is_open_weights))"
    )
    .eq("id", id)
    .single()) as unknown as { data: WatchlistWithItems | null; error: unknown };

  if (error || !watchlist) {
    return NextResponse.json(
      { error: "Watchlist not found" },
      { status: 404 }
    );
  }

  // Check access: must be owner or watchlist must be public
  if (!watchlist.is_public && (!user || watchlist.user_id !== user.id)) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const bodyObj = body as { name?: string; description?: string | null; is_public?: boolean };
  const updates: Record<string, unknown> = {};

  if (bodyObj.name !== undefined) updates.name = bodyObj.name.trim();
  if (bodyObj.description !== undefined)
    updates.description = bodyObj.description?.trim() || null;
  if (bodyObj.is_public !== undefined) updates.is_public = bodyObj.is_public;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
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

  const { error } = await supabase
    .from("watchlists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
