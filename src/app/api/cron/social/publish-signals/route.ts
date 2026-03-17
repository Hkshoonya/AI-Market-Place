import { NextResponse } from "next/server";
import { trackCronRun } from "@/lib/cron-tracker";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishRecentSignalsToCommons } from "@/lib/social/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await trackCronRun("social-publish-signals");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const result = await publishRecentSignalsToCommons(createAdminClient());

    return tracker.complete(result);
  } catch (err) {
    return tracker.fail(err);
  }
}
