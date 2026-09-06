import { NextRequest, NextResponse } from "next/server";
import { ApiError, handleApiError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDataApiEntitlement } from "@/lib/data-api/entitlements";
import { dataBillingCheckoutEnabled, dataBillingConfigured } from "@/lib/data-api/billing/config";
import { requireBillingUser } from "@/lib/data-api/billing/request";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const { user, canPurchase } = await requireBillingUser(request, { mutation: false, managementOnly: true });
    const admin = createAdminClient();
    const configured = dataBillingConfigured();
    const { data: plans, error } = await admin.from("data_api_plans")
      .select("slug, name, monthly_price_cents, monthly_request_limit, checkout_enabled")
      .eq("is_active", true).eq("is_public", true).order("monthly_price_cents");
    if (error) throw new ApiError(503, "Data plans could not be loaded");
    const entitlement = await getDataApiEntitlement(user.id);
    let managed = false;
    let hold = false;
    let status: string | null = null;
    let periodEnd: string | null = null;
    if (configured) {
      const { data: customer, error: customerError } = await admin.from("data_api_billing_customers")
        .select("customer_id, access_hold").eq("user_id", user.id).maybeSingle();
      const { data: subscription, error: subscriptionError } = await admin.from("data_api_subscriptions")
        .select("source, status, current_period_end").eq("user_id", user.id).maybeSingle();
      if (customerError || subscriptionError) throw new ApiError(503, "Billing status could not be loaded");
      managed = Boolean(customer?.customer_id);
      hold = customer?.access_hold ?? false;
      if (subscription?.source === "stripe") { status = subscription.status; periodEnd = subscription.current_period_end; }
    }
    return NextResponse.json({
      entitlement, managed, hold, status, periodEnd,
      plans: (plans ?? []).filter((plan) => ["pro", "business"].includes(plan.slug)).map((plan) => ({
        slug: plan.slug, name: plan.name, monthlyPriceCents: plan.monthly_price_cents,
        requests: Number(plan.monthly_request_limit), checkoutEnabled: configured && dataBillingCheckoutEnabled() && plan.checkout_enabled && !hold && canPurchase,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleApiError(error, "api/data-access/billing"); }
}
