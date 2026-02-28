import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/activity — get recent model updates for models in user's watchlists
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = rateLimit(`activity:${ip}`, RATE_LIMITS.public);
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

  // Get all model IDs from user's watchlists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: watchlistItems } = await (supabase as any)
    .from("watchlist_items")
    .select("model_id, watchlists!inner(user_id)")
    .eq("watchlists.user_id", user.id);

  const modelIds = [
    ...new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (watchlistItems ?? []).map((item: any) => item.model_id as string)
    ),
  ];

  if (modelIds.length === 0) {
    // No watched models — return recent global updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: globalUpdates } = await (supabase as any)
      .from("model_updates")
      .select("*, models(id, slug, name, provider)")
      .order("published_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      data: globalUpdates ?? [],
      watchedModelIds: [],
      isGlobal: true,
    });
  }

  // Get recent updates for watched models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updates, error } = await (supabase as any)
    .from("model_updates")
    .select("*, models(id, slug, name, provider)")
    .in("model_id", modelIds)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: updates ?? [],
    watchedModelIds: modelIds,
    isGlobal: false,
  });
}
