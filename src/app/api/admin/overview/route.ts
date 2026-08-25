import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { systemLog } from "@/lib/logging";
import {
  getClientIp,
  rateLimit,
  RATE_LIMITS,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function runWithTransientRetry<T>(query: () => PromiseLike<T>): Promise<T> {
  let result = await query();
  const firstError = (result as { error?: { message?: string } | null }).error;

  if (firstError?.message && /fetch failed|network error/i.test(firstError.message)) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    result = await query();
  }

  return result;
}

async function sumActiveModelDownloads(
  admin: ReturnType<typeof createAdminClient>,
  activeModelCount: number
): Promise<{ total: number; error: { message: string } | null }> {
  const pageSize = 1_000;
  let total = 0;

  for (let from = 0; from < activeModelCount; from += pageSize) {
    const result = await runWithTransientRetry(() =>
      admin
        .from("models")
        .select("hf_downloads")
        .eq("status", "active")
        .range(from, Math.min(from + pageSize - 1, activeModelCount - 1))
    );

    if (result.error) {
      return { total: 0, error: result.error };
    }

    total += (result.data ?? []).reduce(
      (sum, model) => sum + (Number(model.hf_downloads) || 0),
      0
    );
  }

  return { total, error: null };
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-overview:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const session = await requireAdminSession();
    if (session.error) return session.error;

    const admin = createAdminClient();
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const affiliateCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000)
      .toISOString()
      .slice(0, 10);

    // Keep request fan-out bounded. This page is often opened while pipeline
    // diagnostics are running, and a single 15-query burst can amplify a
    // transient PostgREST/network failure on a constrained Supabase project.
    const [
      totalModelsResult,
      activeModelsResult,
      totalUsersResult,
      totalListingsResult,
      activeListingsResult,
      totalOrdersResult,
    ] = await Promise.all([
      runWithTransientRetry(() =>
        admin.from("models").select("id", { count: "exact", head: true })
      ),
      runWithTransientRetry(() =>
        admin
          .from("models")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
      ),
      runWithTransientRetry(() =>
        admin.from("profiles").select("id", { count: "exact", head: true })
      ),
      runWithTransientRetry(() =>
        admin
          .from("marketplace_listings")
          .select("id", { count: "exact", head: true })
      ),
      runWithTransientRetry(() =>
        admin
          .from("marketplace_listings")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
      ),
      runWithTransientRetry(() =>
        admin
          .from("marketplace_orders")
          .select("id", { count: "exact", head: true })
      ),
    ]);

    const downloadsPromise = sumActiveModelDownloads(
      admin,
      activeModelsResult.count ?? 0
    );

    const [
      recentModelsResult,
      recentUsersResult,
      apiKeysResult,
      connectionsResult,
    ] = await Promise.all([
      runWithTransientRetry(() =>
        admin
          .from("models")
          .select("name, provider, slug, created_at")
          .order("created_at", { ascending: false })
          .limit(5)
      ),
      runWithTransientRetry(() =>
        admin
          .from("profiles")
          .select("id, display_name, email, joined_at")
          .order("joined_at", { ascending: false })
          .limit(5)
      ),
      runWithTransientRetry(() =>
        admin
          .from("api_keys")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true)
      ),
      runWithTransientRetry(() =>
        admin
          .from("provider_connections")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
      ),
    ]);

    const downloadsResult = await downloadsPromise;

    const [
      deploymentsResult,
      subscriptionsResult,
      dataUsageResult,
      affiliateClicksResult,
    ] = await Promise.all([
      runWithTransientRetry(() =>
        admin
          .from("workspace_deployments")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready")
      ),
      runWithTransientRetry(() =>
        admin
          .from("data_api_subscriptions")
          .select("user_id, plan_slug, status, current_period_end")
      ),
      runWithTransientRetry(() =>
        admin
          .from("data_api_usage_monthly")
          .select("request_count")
          .eq("period_start", monthStart)
      ),
      runWithTransientRetry(() =>
        admin
          .from("affiliate_click_daily")
          .select("clicks")
          .gte("click_date", affiliateCutoff)
      ),
    ]);

    const errors = [
      { metric: "total models", error: totalModelsResult.error },
      { metric: "active models", error: activeModelsResult.error },
      { metric: "total users", error: totalUsersResult.error },
      { metric: "total listings", error: totalListingsResult.error },
      { metric: "active listings", error: activeListingsResult.error },
      { metric: "total orders", error: totalOrdersResult.error },
      { metric: "model downloads", error: downloadsResult.error },
      { metric: "recent models", error: recentModelsResult.error },
      { metric: "recent users", error: recentUsersResult.error },
      { metric: "active API keys", error: apiKeysResult.error },
      { metric: "provider connections", error: connectionsResult.error },
      { metric: "ready deployments", error: deploymentsResult.error },
      { metric: "data subscriptions", error: subscriptionsResult.error },
      { metric: "monthly data usage", error: dataUsageResult.error },
      { metric: "affiliate clicks", error: affiliateClicksResult.error },
    ].filter(({ error }) => error !== null);

    if (errors.length > 0) {
      void systemLog.error(
        "api/admin/overview",
        "One or more admin overview queries failed",
        {
          errors: errors.map(
            ({ metric, error }) => `${metric}: ${error?.message ?? "unknown query failure"}`
          ),
        }
      );
      return NextResponse.json(
        { error: "Could not load the admin overview." },
        { status: 500 }
      );
    }

    const now = Date.now();
    const paidDataUsers = new Set(
      (subscriptionsResult.data ?? [])
        .filter(
          (subscription) =>
            subscription.plan_slug !== "free" &&
            (subscription.status === "active" ||
              subscription.status === "trialing") &&
            (!subscription.current_period_end ||
              new Date(subscription.current_period_end).getTime() > now)
        )
        .map((subscription) => subscription.user_id)
    );

    return NextResponse.json(
      {
        stats: {
          totalModels: totalModelsResult.count ?? 0,
          activeModels: activeModelsResult.count ?? 0,
          totalUsers: totalUsersResult.count ?? 0,
          totalListings: totalListingsResult.count ?? 0,
          activeListings: activeListingsResult.count ?? 0,
          totalOrders: totalOrdersResult.count ?? 0,
          totalDownloads: downloadsResult.total,
        },
        activation: {
          activeApiKeys: apiKeysResult.count ?? 0,
          activeProviderConnections: connectionsResult.count ?? 0,
          readyDeployments: deploymentsResult.count ?? 0,
          paidDataCustomers: paidDataUsers.size,
          dataRequestsThisMonth: (dataUsageResult.data ?? []).reduce(
            (sum, usage) => sum + usage.request_count,
            0
          ),
          affiliateClicks30d: (affiliateClicksResult.data ?? []).reduce(
            (sum, click) => sum + click.clicks,
            0
          ),
        },
        recentModels: recentModelsResult.data ?? [],
        recentUsers: recentUsersResult.data ?? [],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return handleApiError(err, "api/admin/overview");
  }
}
