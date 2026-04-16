import { NextRequest, NextResponse } from "next/server";
import { executeTrackedSyncCronJob } from "@/lib/data-sources/cron-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max for long-running cron syncs

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

  return executeTrackedSyncCronJob({ source: source ?? undefined, tier });
}
