import { NextRequest, NextResponse } from "next/server";
import { runSingleSync, runTierSync } from "@/lib/data-sources/orchestrator";
import { trackCronRun } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro)

/**
 * Cron endpoint for data source sync.
 * Protected by CRON_SECRET header.
 *
 * Usage: GET /api/cron/sync?tier=1
 * Called by the configured scheduler (VPS cron, internal cron, or manual recovery).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const tier = parseInt(searchParams.get("tier") || "0");

  if (!source && (tier < 1 || tier > 4)) {
    return NextResponse.json(
      { error: "Invalid request. Provide source or tier=1-4." },
      { status: 400 }
    );
  }

  const tracker = await trackCronRun(source ? `sync-source-${source}` : `sync-tier-${tier}`);
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const result = source ? await runSingleSync(source) : await runTierSync(tier);

    const hasFailed = result.sourcesFailed > 0;

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
        errors: d.errors.map((e) => e.message),
      })),
      overallStatus: hasFailed ? "partial" : "success",
    };

    return tracker.complete(summary);
  } catch (err) {
    return tracker.fail(err);
  }
}
