import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * GET /api/charts/benchmark-heatmap
 *
 * Returns a pivoted benchmark scores matrix for the heatmap chart.
 * Rows = models, Columns = benchmarks, Values = normalized scores.
 *
 * Query params:
 *   category - filter by category (optional)
 *   provider - filter by provider (optional, comma-separated)
 *   limit    - max models (default 30)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const providers = searchParams.get("provider")?.split(",").filter(Boolean);
  const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);

  try {
    // Get top models by quality score
    let modelQuery = supabase
      .from("models")
      .select("id, name, slug, provider, category, quality_score, overall_rank")
      .eq("status", "active")
      .gt("quality_score", 0)
      .order("quality_score", { ascending: false })
      .limit(limit);

    if (category) modelQuery = modelQuery.eq("category", category);
    if (providers && providers.length > 0) {
      modelQuery = modelQuery.in("provider", providers);
    }

    const { data: models, error: modelsError } = await modelQuery;
    if (modelsError) {
      return NextResponse.json({ error: modelsError.message }, { status: 500 });
    }

    if (!models || models.length === 0) {
      return NextResponse.json({ data: [], benchmarks: [], total: 0 });
    }

    const modelIds = models.map((m) => m.id);

    // Get all benchmark scores for these models
    const { data: scores } = await supabase
      .from("benchmark_scores")
      .select("model_id, score_normalized, benchmarks(slug, name)")
      .in("model_id", modelIds);

    // Get all benchmarks that have scores
    const { data: benchmarks } = await supabase
      .from("benchmarks")
      .select("slug, name, category")
      .order("slug");

    // Build the heatmap matrix
    const scoreMap = new Map<string, Map<string, number>>();
    for (const s of scores ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const benchSlug = (s as any).benchmarks?.slug as string | undefined;
      if (!benchSlug || s.score_normalized == null) continue;

      if (!scoreMap.has(s.model_id)) scoreMap.set(s.model_id, new Map());
      scoreMap.get(s.model_id)!.set(benchSlug, Number(s.score_normalized));
    }

    // Determine which benchmarks have any data
    const activeBenchmarkSlugs = new Set<string>();
    for (const modelScores of scoreMap.values()) {
      for (const slug of modelScores.keys()) {
        activeBenchmarkSlugs.add(slug);
      }
    }

    const activeBenchmarks = (benchmarks ?? [])
      .filter((b) => activeBenchmarkSlugs.has(b.slug))
      .map((b) => ({ slug: b.slug, name: b.name, category: b.category }));

    // Build result rows
    const result = models.map((m) => {
      const modelScores = scoreMap.get(m.id);
      const benchmarkScores: Record<string, number | null> = {};

      for (const b of activeBenchmarks) {
        benchmarkScores[b.slug] = modelScores?.get(b.slug) ?? null;
      }

      return {
        name: m.name,
        slug: m.slug,
        provider: m.provider,
        category: m.category,
        qualityScore: m.quality_score,
        rank: m.overall_rank,
        scores: benchmarkScores,
      };
    });

    return NextResponse.json(
      {
        data: result,
        benchmarks: activeBenchmarks,
        total: result.length,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
