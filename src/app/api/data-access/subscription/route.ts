import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDataApiEntitlement } from "@/lib/data-api/entitlements";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const [{ data: plans, error: plansError }, entitlement] = await Promise.all([
      admin
        .from("data_api_plans")
        .select(
          "slug, name, description, monthly_price_cents, monthly_request_limit, rate_limit_per_minute, max_page_size, history_days, features, checkout_enabled"
        )
        .eq("is_active", true)
        .eq("is_public", true)
        .order("monthly_price_cents"),
      getDataApiEntitlement(user.id),
    ]);
    if (plansError) throw plansError;

    return NextResponse.json({
      entitlement,
      plans: (plans ?? []).map((plan) => ({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthly_price_cents,
        monthlyRequestLimit: Number(plan.monthly_request_limit),
        rateLimitPerMinute: plan.rate_limit_per_minute,
        maxPageSize: plan.max_page_size,
        historyDays: plan.history_days,
        features: Array.isArray(plan.features) ? plan.features : [],
        checkoutEnabled: plan.checkout_enabled,
      })),
      billing: {
        checkoutEnabled: false,
        message:
          "Paid data plans are available only by admin grant while payment account setup is deferred.",
      },
    });
  } catch (error) {
    return handleApiError(error, "api/data-access/subscription");
  }
}
