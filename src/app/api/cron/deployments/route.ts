import { NextRequest, NextResponse } from "next/server";
import { trackCronRun } from "@/lib/cron-tracker";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileHostedDeployments } from "@/lib/workspace/reconcile-hosted-deployments";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await trackCronRun("workspace-deployments-reconcile");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const admin = createAdminClient();
    const result = await reconcileHostedDeployments(admin as never);
    return tracker.complete(result);
  } catch (error) {
    return tracker.fail(error);
  }
}
