import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import {
  getClientIp,
  rateLimit,
  RATE_LIMITS,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`account-overview:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "display_name, username, joined_at, is_seller, seller_verified, is_banned"
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Could not load your account profile." },
        { status: 500 }
      );
    }
    if (profile.is_banned) {
      return NextResponse.json({ error: "Account suspended." }, { status: 403 });
    }

    const admin = createAdminClient();
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

    const [
      watchlistsResult,
      bookmarksResult,
      apiKeysResult,
      connectionsResult,
      deploymentCountResult,
      readyDeploymentCountResult,
      deploymentsResult,
      subscriptionsResult,
      usageResult,
      ordersResult,
      listingsResult,
    ] = await Promise.all([
      admin
        .from("watchlists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      admin
        .from("user_bookmarks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      admin
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", user.id)
        .eq("is_active", true),
      admin
        .from("provider_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active"),
      admin
        .from("workspace_deployments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      admin
        .from("workspace_deployments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "ready"),
      admin
        .from("workspace_deployments")
        .select(
          "id, model_slug, model_name, provider_name, status, endpoint_slug, deployment_kind, total_requests, last_used_at, created_at"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
      admin
        .from("data_api_subscriptions")
        .select("plan_slug, status, current_period_end, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      admin
        .from("data_api_usage_monthly")
        .select("request_count, last_request_at")
        .eq("user_id", user.id)
        .eq("period_start", monthStart)
        .maybeSingle(),
      admin
        .from("marketplace_orders")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id),
      admin
        .from("marketplace_listings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id),
    ]);

    const queryResults = [
      ["watchlists", watchlistsResult],
      ["bookmarks", bookmarksResult],
      ["API keys", apiKeysResult],
      ["provider connections", connectionsResult],
      ["deployment count", deploymentCountResult],
      ["ready deployment count", readyDeploymentCountResult],
      ["deployments", deploymentsResult],
      ["data plan", subscriptionsResult],
      ["data usage", usageResult],
      ["orders", ordersResult],
      ["seller listings", listingsResult],
    ] as const;
    const warnings = queryResults
      .filter(([, result]) => result.error)
      .map(([label]) => `Could not load ${label}.`);

    const now = Date.now();
    const currentSubscriptions = (subscriptionsResult.data ?? []).filter(
      (subscription) =>
        (subscription.status === "active" ||
          subscription.status === "trialing") &&
        (!subscription.current_period_end ||
          new Date(subscription.current_period_end).getTime() > now)
    );
    const subscription =
      currentSubscriptions.find((item) => item.plan_slug !== "free") ??
      currentSubscriptions[0] ??
      null;
    const deployments = deploymentsResult.data ?? [];

    return NextResponse.json(
      {
        account: {
          email: user.email ?? null,
          displayName: profile.display_name ?? profile.username ?? null,
          joinedAt: profile.joined_at,
          isSeller: profile.is_seller,
          sellerVerified: profile.seller_verified,
        },
        progress: {
          trackedModels:
            (watchlistsResult.count ?? 0) + (bookmarksResult.count ?? 0),
          activeApiKeys: apiKeysResult.count ?? 0,
          providerConnections: connectionsResult.count ?? 0,
          deployments: deploymentCountResult.count ?? 0,
          readyDeployments: readyDeploymentCountResult.count ?? 0,
        },
        usage: {
          dataRequestsThisMonth: usageResult.data?.request_count ?? 0,
          lastDataRequestAt: usageResult.data?.last_request_at ?? null,
          marketplaceOrders: ordersResult.count ?? 0,
          sellerListings: listingsResult.count ?? 0,
        },
        plan: subscription
          ? {
              slug: subscription.plan_slug,
              status: subscription.status,
              currentPeriodEnd: subscription.current_period_end,
            }
          : { slug: "free", status: "active", currentPeriodEnd: null },
        recentDeployments: deployments,
        warnings,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return handleApiError(err, "api/account/overview");
  }
}
