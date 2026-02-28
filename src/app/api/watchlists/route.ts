import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

const createWatchlistSchema = z.object({
  name: z.string().min(1, "Watchlist name is required").max(100, "Name must be 100 characters or less").transform(s => s.trim()),
  description: z.string().max(500, "Description must be 500 characters or less").optional().nullable().transform(s => s?.trim() || null),
  is_public: z.boolean().optional().default(false),
});

export const dynamic = "force-dynamic";

// GET /api/watchlists — list all watchlists for the authenticated user
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`watchlists:${ip}`, RATE_LIMITS.public);
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
  const { data, error } = await (supabase as any)
    .from("watchlists")
    .select(
      "*, watchlist_items(id, model_id, models(id, slug, name, provider, category, overall_rank, quality_score, hf_downloads, hf_likes))"
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST /api/watchlists — create a new watchlist
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`watchlists-write:${ip}`, RATE_LIMITS.write);
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

  const body = await request.json();
  const parsed = createWatchlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { name, description, is_public } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("watchlists")
    .insert({
      user_id: user.id,
      name,
      description,
      is_public,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
