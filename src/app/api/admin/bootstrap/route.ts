import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTierSync } from "@/lib/data-sources/orchestrator";
import type { OrchestratorResult } from "@/lib/data-sources/orchestrator";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for long-running bootstrap work

// POST /api/admin/bootstrap
// Runs all data pipeline tiers sequentially to populate an empty database.
// Tiers are intentionally sequential: tier 2 enrichment needs tier 1 models.
export async function POST(_request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Admin check
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 3. Run tiers 1 → 4 sequentially.
    // Each tier is bounded by the route maxDuration, while the per-adapter
    // timeout inside the orchestrator remains the real guard per source.
    const results: Record<string, { status: string } & Partial<OrchestratorResult> & { error?: string }> = {};

    for (const tier of [1, 2, 3, 4] as const) {
      try {
        const result = await runTierSync(tier);
        results[`tier_${tier}`] = {
          status: "completed",
          ...result,
        };
      } catch (err) {
        results[`tier_${tier}`] = {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Bootstrap complete",
      results,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/bootstrap");
  }
}
