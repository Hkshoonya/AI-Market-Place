import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";

export const revalidate = 300; // 5 min cache

export async function GET() {
  try {
    const supabase = await createClient();

    // Get top 15 models by popularity
    const { data: models } = await supabase
      .from("models")
      .select("id, name, slug, provider, popularity_score, overall_rank, quality_score")
      .eq("status", "active")
      .not("popularity_score", "is", null)
      .order("popularity_rank", { ascending: true })
      .limit(15);

    if (!models || models.length === 0) return NextResponse.json([]);

    // Get previous snapshots for delta calculation
    const modelIds = models.map((m) => m.id);
    const { data: snapshots } = await supabase
      .from("model_snapshots")
      .select("model_id, popularity_score, snapshot_date")
      .in("model_id", modelIds)
      .order("snapshot_date", { ascending: false })
      .limit(30);

    const previousScores = new Map<string, number>();
    const seen = new Set<string>();
    for (const s of (snapshots ?? [])) {
      if (s.popularity_score == null) continue;
      if (seen.has(s.model_id)) {
        if (!previousScores.has(s.model_id)) {
          previousScores.set(s.model_id, Number(s.popularity_score));
        }
      } else {
        seen.add(s.model_id);
      }
    }

    const tickerData = models.map((m) => {
      const prev = previousScores.get(m.id);
      const delta = prev != null && m.popularity_score != null
        ? Math.round((m.popularity_score - prev) * 10) / 10
        : null;
      return {
        name: m.name,
        slug: m.slug,
        provider: m.provider,
        score: m.popularity_score,
        delta,
        rank: m.overall_rank,
      };
    });

    return NextResponse.json(tickerData);
  } catch (err) {
    return handleApiError(err, "api/charts/ticker");
  }
}
