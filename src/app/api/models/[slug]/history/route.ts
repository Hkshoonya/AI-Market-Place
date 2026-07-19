import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { handleApiError } from "@/lib/api-error";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const paywall = await checkPaywall(request);
    if (!paywall.allowed) return paywallErrorResponse(paywall);

    const parsedSlug = SlugSchema.safeParse((await params).slug);
    if (!parsedSlug.success) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const requestedDays = Number.parseInt(
      new URL(request.url).searchParams.get("days") || "30",
      10
    );
    const days = Math.min(
      Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : 30,
      paywall.historyDays ?? 90
    );
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: model, error: modelError } = await supabase
      .from("models")
      .select("id, slug, name, provider")
      .eq("slug", parsedSlug.data)
      .eq("status", "active")
      .maybeSingle();
    if (modelError) throw modelError;
    if (!model) {
      return NextResponse.json({ error: "Model not found" }, { status: 404 });
    }

    const cutoff = new Date(Date.now() - days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { data: snapshots, error: snapshotsError } = await supabase
      .from("model_snapshots")
      .select(
        "snapshot_date, overall_rank, quality_score, capability_score, popularity_score, adoption_score, economic_footprint_score, usage_score, expert_score, market_cap_estimate, hf_downloads, hf_likes, source_coverage"
      )
      .eq("model_id", model.id)
      .gte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: true });
    if (snapshotsError) throw snapshotsError;

    return NextResponse.json({
      model: {
        slug: model.slug,
        name: model.name,
        provider: model.provider,
      },
      data: snapshots ?? [],
      period: {
        days,
        availableFrom: cutoff,
      },
      access: paywall.planSlug
        ? {
            plan: paywall.planSlug,
            quotaRemaining: paywall.quotaRemaining,
            quotaLimit: paywall.quotaLimit,
          }
        : { plan: "public" },
    });
  } catch (error) {
    return handleApiError(error, "api/models/[slug]/history");
  }
}
