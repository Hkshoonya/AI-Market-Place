import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";

export const dynamic = "force-dynamic";

// POST /api/watchlists/[id]/items — add a model to a watchlist
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`watchlist-items:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  const { id: watchlistId } = await params;
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
  const { model_id } = body as { model_id?: string };

  if (!model_id) {
    return NextResponse.json(
      { error: "model_id is required" },
      { status: 400 }
    );
  }

  // Verify user owns the watchlist
  const { data: watchlist } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", user.id)
    .single();

  if (!watchlist) {
    return NextResponse.json(
      { error: "Watchlist not found or not owned by you" },
      { status: 404 }
    );
  }

  // Check if model is already in watchlist
  const { data: existing } = await supabase
    .from("watchlist_items")
    .select("id")
    .eq("watchlist_id", watchlistId)
    .eq("model_id", model_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Model already in this watchlist" },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      watchlist_id: watchlistId,
      model_id,
    })
    .select("*, models(id, slug, name, provider)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Touch the watchlist updated_at
  await supabase
    .from("watchlists")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", watchlistId);

  return NextResponse.json({ data }, { status: 201 });
}

// DELETE /api/watchlists/[id]/items — remove a model from a watchlist
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: watchlistId } = await params;
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

  const { searchParams } = new URL(request.url);
  const modelId = searchParams.get("model_id");

  if (!modelId) {
    return NextResponse.json(
      { error: "model_id query param is required" },
      { status: 400 }
    );
  }

  // Verify user owns the watchlist
  const { data: watchlist } = await supabase
    .from("watchlists")
    .select("id")
    .eq("id", watchlistId)
    .eq("user_id", user.id)
    .single();

  if (!watchlist) {
    return NextResponse.json(
      { error: "Watchlist not found or not owned by you" },
      { status: 404 }
    );
  }

  const { error } = await supabase
    .from("watchlist_items")
    .delete()
    .eq("watchlist_id", watchlistId)
    .eq("model_id", modelId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
