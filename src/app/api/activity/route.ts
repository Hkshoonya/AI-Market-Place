import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

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

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all model IDs from user's watchlists
    // NOTE: embedded join `watchlists!inner(user_id)` returns a runtime join but
    // the SDK infers `never` without FK Relationships — cast to the expected shape.
    const { data: watchlistItems } = await supabase
      .from("watchlist_items")
      .select("model_id, watchlists!inner(user_id)")
      .eq("watchlists.user_id", user.id) as unknown as {
        data: Array<{ model_id: string }> | null;
        error: null;
      };

    const modelIds = [
      ...new Set(
        (watchlistItems ?? []).map((item) => item.model_id)
      ),
    ];

    if (modelIds.length === 0) {
      // No watched models — return recent global updates
      const { data: globalUpdates } = await supabase
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
    const { data: updates, error } = await supabase
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
  } catch (err) {
    return handleApiError(err, "api/activity");
  }
}
