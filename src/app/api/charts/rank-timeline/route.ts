import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/charts/rank-timeline
 *
 * Returns rank/score history from model_snapshots for tracking
 * model position changes over time.
 *
 * Query params:
 *   slugs    - comma-separated model slugs (required, max 10)
 *   days     - lookback period (default 30, max 365)
 *   metric   - "rank" or "score" (default "rank")
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { searchParams } = new URL(request.url);
  const slugsParam = searchParams.get("slugs");
  const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
  const metric = searchParams.get("metric") || "rank";

  if (!slugsParam) {
    return NextResponse.json({ error: "slugs param required" }, { status: 400 });
  }

  const slugs = slugsParam.split(",").filter(Boolean).slice(0, 10);

  try {
    // Resolve slugs to model IDs
    const { data: models } = await supabase
      .from("models")
      .select("id, name, slug, provider")
      .in("slug", slugs);

    if (!models || models.length === 0) {
      return NextResponse.json({ data: [], models: [] });
    }

    const modelIds = models.map((m) => m.id);
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Fetch snapshots
    const { data: snapshots } = await supabase
      .from("model_snapshots")
      .select("model_id, snapshot_date, quality_score, overall_rank")
      .in("model_id", modelIds)
      .gte("snapshot_date", cutoffDate)
      .order("snapshot_date", { ascending: true });

    // Group by date for charting
    const dateMap = new Map<string, Record<string, number | null>>();
    const modelIdToSlug = new Map(models.map((m) => [m.id, m.slug]));

    for (const snap of snapshots ?? []) {
      const date = snap.snapshot_date;
      const slug = modelIdToSlug.get(snap.model_id);
      if (!slug) continue;

      if (!dateMap.has(date)) dateMap.set(date, {});
      const entry = dateMap.get(date)!;
      entry[slug] = metric === "rank" ? snap.overall_rank : snap.quality_score;
    }

    // Convert to array sorted by date
    const timeline = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({
        date,
        ...values,
      }));

    const modelInfo = models.map((m) => ({
      slug: m.slug,
      name: m.name,
      provider: m.provider,
    }));

    return NextResponse.json(
      { data: timeline, models: modelInfo, metric, days },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return handleApiError(err, "api/charts/rank-timeline");
  }
}
