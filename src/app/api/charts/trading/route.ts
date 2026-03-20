import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";

export const revalidate = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const modelSlug = searchParams.get("model");
  const range = searchParams.get("range") || "30d";
  const metric = searchParams.get("metric") || "popularity_score";

  try {
    const supabase = await createClient();

    // Determine date range
    const rangeMap: Record<string, number> = {
      "7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650,
    };
    const days = rangeMap[range] || 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Build query
    let query = supabase
      .from("model_snapshots")
      .select("model_id, snapshot_date, quality_score, popularity_score, adoption_score, economic_footprint_score, market_cap_estimate, hf_downloads, overall_rank, agent_score")
      .gte("snapshot_date", since)
      .order("snapshot_date", { ascending: true });

    if (modelSlug) {
      // Look up model ID from slug
      const { data: model } = await supabase
        .from("models")
        .select("id")
        .eq("slug", modelSlug)
        .single();

      if (!model) {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
      query = query.eq("model_id", model.id);
    }

    const { data: snapshots } = await query.limit(1000);
    if (!snapshots) return NextResponse.json([]);

    // Group by date for OHLC-style data
    const byDate = new Map<string, number[]>();
    for (const s of snapshots) {
      const value = (s as Record<string, unknown>)[metric] as number | null;
      if (value == null) continue;
      const date = s.snapshot_date as string;
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date)!.push(value);
    }

    // Convert to candlestick format
    const candles = Array.from(byDate.entries()).map(([date, values]) => {
      const sorted = values.sort((a, b) => a - b);
      return {
        time: date,
        open: sorted[0],
        high: sorted[sorted.length - 1],
        low: sorted[0],
        close: sorted[sorted.length - 1],
        value: sorted[sorted.length - 1], // latest value for line chart
      };
    }).sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json(candles);
  } catch (err) {
    return handleApiError(err, "api/charts/trading");
  }
}
