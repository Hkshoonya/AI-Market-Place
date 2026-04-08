import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { handleApiError } from "@/lib/api-error";
import { providerMatchesCanonical } from "@/lib/constants/providers";
import { isFreshVerifiedPricingEntry } from "@/lib/models/pricing";
import { dedupePublicModelFamilies } from "@/lib/models/public-families";
import { preferDefaultPublicSurfaceReady } from "@/lib/models/public-surface-readiness";

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
    const rawLimit = Math.min(Math.max(limit * 8, 200), 2000);

    // Fetch models with quality scores
    let query = supabase
      .from("models")
      .select(
        "id, name, slug, provider, category, quality_score, value_score, overall_rank, parameter_count, is_open_weights"
      )
      .eq("status", "active")
      .gt("quality_score", 0)
      .order("quality_score", { ascending: false })
      .limit(rawLimit);

    if (category) query = query.eq("category", category);
    const { data: models, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredModels =
      providers && providers.length > 0
        ? preferDefaultPublicSurfaceReady(dedupePublicModelFamilies(models ?? []), 12).filter((model) =>
            providers.some((provider) => providerMatchesCanonical(model.provider, provider))
          )
        : preferDefaultPublicSurfaceReady(dedupePublicModelFamilies(models ?? []), 12);

    const visibleModels = filteredModels.slice(0, limit);

    // Fetch pricing for these models
    const modelIds = visibleModels.map((m) => m.id);
    if (modelIds.length === 0) {
      return NextResponse.json({ data: [], total: 0 });
    }
    const { data: pricing } = await supabase
      .from("model_pricing")
      .select("model_id, input_price_per_million, output_price_per_million, provider_name, effective_date, updated_at")
      .in("model_id", modelIds)
      .not("input_price_per_million", "is", null);

    // Build cheapest price map
    const priceMap = new Map<string, { input: number; output: number; provider: string }>();
    for (const p of pricing ?? []) {
      if (
        !isFreshVerifiedPricingEntry({
          provider_name: p.provider_name ?? "",
          input_price_per_million: Number(p.input_price_per_million ?? 0),
          output_price_per_million: Number(p.output_price_per_million ?? 0),
          effective_date: typeof p.effective_date === "string" ? p.effective_date : null,
          updated_at: typeof p.updated_at === "string" ? p.updated_at : null,
        })
      ) {
        continue;
      }
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

    const result = visibleModels.map((m) => {
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
          "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    return handleApiError(err, "api/charts/quality-price");
  }
}
