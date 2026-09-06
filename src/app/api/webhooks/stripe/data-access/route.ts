import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { getDataBillingConfig } from "@/lib/data-api/billing/config";
import { processDataBillingEvent, readDataBillingEvent } from "@/lib/data-api/billing/webhook";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const config = getDataBillingConfig();
    const event = await readDataBillingEvent(request, config.webhookSecret);
    return NextResponse.json({ received: true, ...await processDataBillingEvent(config, event) });
  } catch (error) { return handleApiError(error, "api/webhooks/stripe/data-access"); }
}
