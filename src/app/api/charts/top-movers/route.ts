import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/charts/top-movers
 *
 * Returns models with the biggest rank changes (up and down)
 * by comparing today's snapshot with yesterday's.
 *
 * Query params:
 *   limit - number of movers in each direction (default 10)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Get today's and yesterday's snapshots
    const { data: todaySnaps } = await supabase
      .from("model_snapshots")
      .select("model_id, overall_rank, quality_score")
      .eq("snapshot_date", today);

    const { data: yesterdaySnaps } = await supabase
      .from("model_snapshots")
      .select("model_id, overall_rank, quality_score")
      .eq("snapshot_date", yesterday);

    if (!todaySnaps || todaySnaps.length === 0) {
      // Try comparing the two most recent dates instead
      const { data: recentDates } = await supabase
        .from("model_snapshots")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(2);

      if (!recentDates || recentDates.length < 2) {
        return NextResponse.json({ risers: [], fallers: [], asOf: today });
      }

      // Use the two most recent dates
      const [latestDate, prevDate] = [
        recentDates[0].snapshot_date,
        recentDates[1].snapshot_date,
      ];

      const { data: latestSnaps } = await supabase
        .from("model_snapshots")
        .select("model_id, overall_rank, quality_score")
        .eq("snapshot_date", latestDate);

      const { data: prevSnaps } = await supabase
        .from("model_snapshots")
        .select("model_id, overall_rank, quality_score")
        .eq("snapshot_date", prevDate);

      return computeMovers(supabase, latestSnaps ?? [], prevSnaps ?? [], limit, latestDate);
    }

    return computeMovers(supabase, todaySnaps, yesterdaySnaps ?? [], limit, today);
  } catch (err) {
    return handleApiError(err, "api/charts/top-movers");
  }
}

async function computeMovers(
  supabase: ReturnType<typeof createClient<Database>>,
  currentSnaps: Array<{ model_id: string; overall_rank: number | null; quality_score: number | null }>,
  previousSnaps: Array<{ model_id: string; overall_rank: number | null; quality_score: number | null }>,
  limit: number,
  asOf: string
) {
  const prevMap = new Map(
    previousSnaps.map((s) => [s.model_id, s])
  );

  const deltas: Array<{
    modelId: string;
    rankChange: number;
    scoreChange: number;
    currentRank: number;
    currentScore: number;
  }> = [];

  for (const snap of currentSnaps) {
    if (snap.overall_rank == null) continue;
    const prev = prevMap.get(snap.model_id);
    if (!prev || prev.overall_rank == null) continue;

    const rankChange = prev.overall_rank - snap.overall_rank; // positive = moved up
    const scoreChange = (snap.quality_score ?? 0) - (prev.quality_score ?? 0);

    deltas.push({
      modelId: snap.model_id,
      rankChange,
      scoreChange,
      currentRank: snap.overall_rank,
      currentScore: snap.quality_score ?? 0,
    });
  }

  // Get top risers and fallers
  const risers = deltas
    .filter((d) => d.rankChange > 0)
    .sort((a, b) => b.rankChange - a.rankChange)
    .slice(0, limit);

  const fallers = deltas
    .filter((d) => d.rankChange < 0)
    .sort((a, b) => a.rankChange - b.rankChange)
    .slice(0, limit);

  // Fetch model details
  const allModelIds = [...risers, ...fallers].map((d) => d.modelId);
  const { data: models } = await supabase
    .from("models")
    .select("id, name, slug, provider, category")
    .in("id", allModelIds);

  const modelMap = new Map((models ?? []).map((m) => [m.id, m]));

  const formatMovers = (items: typeof risers) =>
    items.map((d) => {
      const m = modelMap.get(d.modelId);
      return {
        name: m?.name ?? "Unknown",
        slug: m?.slug ?? "",
        provider: m?.provider ?? "",
        category: m?.category ?? "",
        rankChange: d.rankChange,
        scoreChange: Math.round(d.scoreChange * 10) / 10,
        currentRank: d.currentRank,
        currentScore: d.currentScore,
      };
    });

  return NextResponse.json(
    {
      risers: formatMovers(risers),
      fallers: formatMovers(fallers),
      asOf,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
