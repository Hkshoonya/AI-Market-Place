import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * GET /api/charts/quality-price
 *
 * Returns model data for the Quality vs Price Frontier scatter chart.
 * Joins models with model_pricing to get quality score + input price.
 *
 * Query params:
 *   category - filter by category (optional)
 *   provider - filter by provider (optional, comma-separated)
 *   limit    - max results (default 200)
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
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  try {
    // Fetch models with quality scores
    let query = supabase
      .from("models")
      .select(
        "id, name, slug, provider, category, quality_score, value_score, overall_rank, parameter_count, is_open_weights"
      )
      .eq("status", "active")
      .gt("quality_score", 0)
      .order("quality_score", { ascending: false })
      .limit(limit);

    if (category) query = query.eq("category", category);
    if (providers && providers.length > 0) {
      query = query.in("provider", providers);
    }

    const { data: models, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch pricing for these models
    const modelIds = (models ?? []).map((m) => m.id);
    const { data: pricing } = await supabase
      .from("model_pricing")
      .select("model_id, input_price_per_million, output_price_per_million, provider_name")
      .in("model_id", modelIds)
      .not("input_price_per_million", "is", null);

    // Build cheapest price map
    const priceMap = new Map<string, { input: number; output: number; provider: string }>();
    for (const p of pricing ?? []) {
      const input = Number(p.input_price_per_million);
      if (input <= 0) continue;
      const existing = priceMap.get(p.model_id);
      if (!existing || input < existing.input) {
        priceMap.set(p.model_id, {
          input,
          output: Number(p.output_price_per_million) || 0,
          provider: p.provider_name || "",
        });
      }
    }

    const result = (models ?? []).map((m) => {
      const price = priceMap.get(m.id);
      return {
        name: m.name,
        slug: m.slug,
        provider: m.provider,
        category: m.category,
        qualityScore: m.quality_score,
        valueScore: m.value_score,
        rank: m.overall_rank,
        parameterCount: m.parameter_count ? Number(m.parameter_count) : null,
        isOpenWeights: m.is_open_weights,
        inputPrice: price?.input ?? null,
        outputPrice: price?.output ?? null,
        pricingProvider: price?.provider ?? null,
      };
    });

    return NextResponse.json(
      { data: result, total: result.length },
      {
        headers: {
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    return handleApiError(err, "api/charts/quality-price");
  }
}
