import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { rateLimit, RATE_LIMITS, getClientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { checkPaywall, paywallErrorResponse } from "@/lib/middleware/api-paywall";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = getClientIp(request);
  const rl = rateLimit(`model-detail:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    // Paywall check
    const pw = await checkPaywall(request);
    if (!pw.allowed) return paywallErrorResponse(pw);

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { slug } = await params;

    const { data, error } = await supabase
      .from("models")
      .select(
        `
        *,
        benchmark_scores(*, benchmarks(*)),
        model_pricing(*),
        elo_ratings(*),
        rankings(*),
        model_updates(*)
      `
      )
      .eq("slug", slug)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Model not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err, "api/models");
  }
}
