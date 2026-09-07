import { NextRequest, NextResponse } from "next/server";
import { trackCronRun } from "@/lib/cron-tracker";
import { reconcileDataBilling } from "@/lib/data-api/billing/reconcile";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (process.env.DATA_API_BILLING_RECONCILE_ENABLED !== "true") return NextResponse.json({ disabled: true });
  const tracker = await trackCronRun("data-billing-reconcile");
  if (tracker.shouldSkip) return tracker.skip();
  try { return tracker.complete(await reconcileDataBilling()); }
  catch (error) { return tracker.fail(error); }
}
