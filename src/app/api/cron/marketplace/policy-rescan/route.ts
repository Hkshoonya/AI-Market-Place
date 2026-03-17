import { NextRequest, NextResponse } from "next/server";

import { trackCronRun } from "@/lib/cron-tracker";
import { rescanMarketplaceListingPolicies } from "@/lib/marketplace/policy-rescan";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const onlyMissing = searchParams.get("mode") !== "all";
  const limit = Math.max(1, Math.min(Number(searchParams.get("limit") || "500"), 2000));

  const tracker = await trackCronRun("marketplace-policy-rescan");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const result = await rescanMarketplaceListingPolicies(createAdminClient(), {
      onlyMissing,
      limit,
    });

    return tracker.complete(result);
  } catch (err) {
    return tracker.fail(err);
  }
}
