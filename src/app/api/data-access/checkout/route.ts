import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { createDataCheckout } from "@/lib/data-api/billing/checkout";
import { dataBillingCheckoutEnabled, getDataBillingConfig } from "@/lib/data-api/billing/config";
import { readBillingBody, requireBillingUser } from "@/lib/data-api/billing/request";

export const dynamic = "force-dynamic";
const schema = z.object({ plan: z.enum(["pro", "business"]) }).strict();

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireBillingUser(request);
    if (!dataBillingCheckoutEnabled()) throw new ApiError(503, "Data subscription checkout is not enabled");
    const parsed = schema.safeParse(await readBillingBody(request));
    if (!parsed.success) throw new ApiError(400, "Choose a valid data plan");
    const url = await createDataCheckout(getDataBillingConfig(), user, parsed.data.plan);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error, "api/data-access/checkout"); }
}
