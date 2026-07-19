import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

function currentUtcPeriodStart() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export interface DataApiEntitlement {
  plan: {
    slug: string;
    name: string;
    description: string;
    monthlyPriceCents: number;
    monthlyRequestLimit: number;
    rateLimitPerMinute: number;
    maxPageSize: number;
    historyDays: number;
    features: string[];
    checkoutEnabled: boolean;
  };
  subscription: {
    status: string;
    source: string;
    currentPeriodStart: string;
    currentPeriodEnd: string | null;
  } | null;
  usage: {
    periodStart: string;
    requestCount: number;
    requestLimit: number;
    remaining: number;
    percentUsed: number;
    lastRequestAt: string | null;
  };
}

function normalizeFeatures(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getDataApiEntitlement(userId: string): Promise<DataApiEntitlement> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: subscription, error: subscriptionError } = await admin
    .from("data_api_subscriptions")
    .select("plan_slug, status, source, current_period_start, current_period_end")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .or(`current_period_end.is.null,current_period_end.gt.${now}`)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;

  const planSlug = subscription?.plan_slug ?? "free";
  const { data: plan, error: planError } = await admin
    .from("data_api_plans")
    .select(
      "slug, name, description, monthly_price_cents, monthly_request_limit, rate_limit_per_minute, max_page_size, history_days, features, checkout_enabled"
    )
    .eq("slug", planSlug)
    .eq("is_active", true)
    .single();
  if (planError || !plan) throw planError ?? new Error("Data API plan is unavailable");

  const periodStart = currentUtcPeriodStart();
  const { data: usage, error: usageError } = await admin
    .from("data_api_usage_monthly")
    .select("request_count, last_request_at")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .maybeSingle();
  if (usageError) throw usageError;

  const requestCount = Number(usage?.request_count ?? 0);
  const requestLimit = Number(plan.monthly_request_limit);

  return {
    plan: {
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      monthlyPriceCents: plan.monthly_price_cents,
      monthlyRequestLimit: requestLimit,
      rateLimitPerMinute: plan.rate_limit_per_minute,
      maxPageSize: plan.max_page_size,
      historyDays: plan.history_days,
      features: normalizeFeatures(plan.features),
      checkoutEnabled: plan.checkout_enabled,
    },
    subscription: subscription
      ? {
          status: subscription.status,
          source: subscription.source,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
        }
      : null,
    usage: {
      periodStart,
      requestCount,
      requestLimit,
      remaining: Math.max(0, requestLimit - requestCount),
      percentUsed:
        requestLimit > 0
          ? Number(Math.min(100, (requestCount / requestLimit) * 100).toFixed(1))
          : 100,
      lastRequestAt: usage?.last_request_at ?? null,
    },
  };
}

export async function consumeDataApiQuota(input: {
  userId: string;
  apiKeyId: string;
  endpoint: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_data_api_quota", {
    p_user_id: input.userId,
    p_api_key_id: input.apiKeyId,
    p_endpoint: input.endpoint,
  });
  if (error) throw error;

  const result = data?.[0];
  if (!result) throw new Error("Data API quota service returned no result");

  return {
    allowed: result.allowed,
    planSlug: result.plan_slug,
    requestCount: Number(result.request_count),
    requestLimit: Number(result.request_limit),
    rateLimitPerMinute: result.rate_limit_per_minute,
    periodStart: result.period_start,
    periodEnd: result.period_end,
  };
}
