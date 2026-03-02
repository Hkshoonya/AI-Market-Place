import { NextRequest, NextResponse } from "next/server";
import { runTierSync } from "@/lib/data-sources/orchestrator";
import { trackCronRun } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

/**
 * Vercel Cron endpoint for data source sync.
 * Protected by CRON_SECRET header.
 *
 * Usage: GET /api/cron/sync?tier=1
 * Called by Vercel Cron (configured in vercel.json)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends authorization header)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tier = parseInt(searchParams.get("tier") || "0");

  if (tier < 1 || tier > 4) {
    return NextResponse.json(
      { error: "Invalid tier. Must be 1-4." },
      { status: 400 }
    );
  }

  const tracker = await trackCronRun(`sync-tier-${tier}`);

  try {
    const result = await runTierSync(tier);

    const summary = {
      tier: result.tier,
      sourcesRun: result.sourcesRun,
      sourcesSucceeded: result.sourcesSucceeded,
      sourcesFailed: result.sourcesFailed,
      details: result.details.map((d) => ({
        source: d.source,
        status: d.status,
        records: d.recordsProcessed,
        durationMs: d.durationMs,
        errors: d.errors.length,
      })),
    };

    return tracker.complete(summary);
  } catch (err) {
    return tracker.fail(err);
  }
}
