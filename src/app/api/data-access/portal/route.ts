import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { createDataPortal } from "@/lib/data-api/billing/checkout";
import { getDataBillingConfig } from "@/lib/data-api/billing/config";
import { requireBillingUser } from "@/lib/data-api/billing/request";

export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const { user } = await requireBillingUser(request, { managementOnly: true });
    // Customers must still be able to cancel when new sales are disabled.
    const url = await createDataPortal(getDataBillingConfig(), user.id);
    return NextResponse.json({ url }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error, "api/data-access/portal"); }
}
