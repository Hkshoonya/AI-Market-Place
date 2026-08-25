import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/auth/require-admin";
import {
  getClientIp,
  rateLimit,
  RATE_LIMITS,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { rejectUntrustedRequestOrigin } from "@/lib/security/request-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertUuid, sanitizeFilterValue } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const AUTH_DIRECTORY_LIMIT = 1_000;
const ALLOWED_ROLES = new Set([
  "all",
  "admin",
  "seller",
  "verified_seller",
  "banned",
]);

type ActivationStage = "new" | "engaged" | "activated" | "customer";

interface ActivationAccumulator {
  bookmarks: number;
  watchlists: number;
  apiKeys: number;
  providerConnections: number;
  runtimes: number;
  deployments: number;
  requests: number;
  paidPlan: string | null;
  lastActivityAt: string | null;
}

interface ActivationSummary extends ActivationAccumulator {
  stage: ActivationStage;
}

function createActivationAccumulator(): ActivationAccumulator {
  return {
    bookmarks: 0,
    watchlists: 0,
    apiKeys: 0,
    providerConnections: 0,
    runtimes: 0,
    deployments: 0,
    requests: 0,
    paidPlan: null,
    lastActivityAt: null,
  };
}

function newestTimestamp(current: string | null, candidate: string | null | undefined) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime()
    ? candidate
    : current;
}

function activationFor(
  activation: Map<string, ActivationAccumulator>,
  userId: string
) {
  const current = activation.get(userId);
  if (current) return current;

  const created = createActivationAccumulator();
  activation.set(userId, created);
  return created;
}

function finalizeActivation(value?: ActivationAccumulator): ActivationSummary {
  const activation = value ?? createActivationAccumulator();

  let stage: ActivationStage = "new";
  if (activation.paidPlan) {
    stage = "customer";
  } else if (
    activation.providerConnections > 0 ||
    activation.deployments > 0 ||
    activation.requests > 0
  ) {
    stage = "activated";
  } else if (
    activation.bookmarks > 0 ||
    activation.watchlists > 0 ||
    activation.apiKeys > 0 ||
    activation.runtimes > 0
  ) {
    stage = "engaged";
  }

  return { ...activation, stage };
}

function authDetails(user?: User) {
  if (!user) return null;

  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : user.identities?.[0]?.provider ?? null;

  return {
    confirmed: Boolean(user.email_confirmed_at || user.phone_confirmed_at),
    provider,
    lastSignInAt: user.last_sign_in_at ?? null,
    bannedUntil: user.banned_until ?? null,
    authCreatedAt: user.created_at,
  };
}

async function loadActivationByUser(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[]
) {
  const activation = new Map<string, ActivationAccumulator>();
  const warnings: string[] = [];

  if (userIds.length === 0) return { activation, warnings };

  const [
    watchlistsResult,
    bookmarksResult,
    keysResult,
    connectionsResult,
    runtimesResult,
    deploymentsResult,
    subscriptionsResult,
    usageResult,
  ] = await Promise.all([
    admin.from("watchlists").select("user_id, updated_at").in("user_id", userIds),
    admin.from("user_bookmarks").select("user_id, created_at").in("user_id", userIds),
    admin
      .from("api_keys")
      .select("owner_id, is_active, created_at, last_used_at")
      .in("owner_id", userIds),
    admin
      .from("provider_connections")
      .select("user_id, status, created_at, last_used_at")
      .in("user_id", userIds),
    admin
      .from("workspace_runtimes")
      .select("user_id, status, total_requests, created_at, last_used_at")
      .in("user_id", userIds),
    admin
      .from("workspace_deployments")
      .select("user_id, status, total_requests, created_at, last_used_at")
      .in("user_id", userIds),
    admin
      .from("data_api_subscriptions")
      .select("user_id, plan_slug, status, current_period_end, created_at")
      .in("user_id", userIds),
    admin
      .from("data_api_usage_monthly")
      .select("user_id, request_count, last_request_at")
      .in("user_id", userIds),
  ]);

  const results = [
    ["watchlists", watchlistsResult],
    ["bookmarks", bookmarksResult],
    ["API keys", keysResult],
    ["provider connections", connectionsResult],
    ["workspace runtimes", runtimesResult],
    ["workspace deployments", deploymentsResult],
    ["data subscriptions", subscriptionsResult],
    ["data API usage", usageResult],
  ] as const;

  for (const [label, result] of results) {
    if (result.error) warnings.push(`Could not load ${label}.`);
  }

  for (const row of watchlistsResult.data ?? []) {
    const value = activationFor(activation, row.user_id);
    value.watchlists += 1;
    value.lastActivityAt = newestTimestamp(value.lastActivityAt, row.updated_at);
  }

  for (const row of bookmarksResult.data ?? []) {
    const value = activationFor(activation, row.user_id);
    value.bookmarks += 1;
    value.lastActivityAt = newestTimestamp(value.lastActivityAt, row.created_at);
  }

  for (const row of keysResult.data ?? []) {
    if (!row.is_active) continue;
    const value = activationFor(activation, row.owner_id);
    value.apiKeys += 1;
    value.lastActivityAt = newestTimestamp(
      value.lastActivityAt,
      row.last_used_at ?? row.created_at
    );
  }

  for (const row of connectionsResult.data ?? []) {
    if (row.status !== "active") continue;
    const value = activationFor(activation, row.user_id);
    value.providerConnections += 1;
    value.lastActivityAt = newestTimestamp(
      value.lastActivityAt,
      row.last_used_at ?? row.created_at
    );
  }

  for (const row of runtimesResult.data ?? []) {
    const value = activationFor(activation, row.user_id);
    value.runtimes += 1;
    value.requests += row.total_requests;
    value.lastActivityAt = newestTimestamp(
      value.lastActivityAt,
      row.last_used_at ?? row.created_at
    );
  }

  for (const row of deploymentsResult.data ?? []) {
    const value = activationFor(activation, row.user_id);
    value.deployments += 1;
    value.requests += row.total_requests;
    value.lastActivityAt = newestTimestamp(
      value.lastActivityAt,
      row.last_used_at ?? row.created_at
    );
  }

  const now = Date.now();
  for (const row of subscriptionsResult.data ?? []) {
    const isCurrent =
      (row.status === "active" || row.status === "trialing") &&
      (!row.current_period_end || new Date(row.current_period_end).getTime() > now);
    if (!isCurrent || row.plan_slug === "free") continue;

    const value = activationFor(activation, row.user_id);
    value.paidPlan = row.plan_slug;
    value.lastActivityAt = newestTimestamp(value.lastActivityAt, row.created_at);
  }

  for (const row of usageResult.data ?? []) {
    const value = activationFor(activation, row.user_id);
    value.requests += row.request_count;
    value.lastActivityAt = newestTimestamp(value.lastActivityAt, row.last_request_at);
  }

  return { activation, warnings };
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-users:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const session = await requireAdminSession();
    if (session.error) return session.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(
      1,
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1
    );
    const requestedRole = searchParams.get("role") ?? "all";
    const role = ALLOWED_ROLES.has(requestedRole) ? requestedRole : "all";
    const safeSearch = sanitizeFilterValue(searchParams.get("search") ?? "");
    const admin = createAdminClient();

    let query = admin
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, is_admin, is_approved, is_seller, seller_verified, is_banned, joined_at, last_login, total_sales, seller_bio, seller_website, seller_rating, bio, email, created_at, updated_at",
        { count: "exact" }
      );

    if (role === "admin") query = query.eq("is_admin", true);
    if (role === "seller") query = query.eq("is_seller", true);
    if (role === "banned") query = query.eq("is_banned", true);
    if (role === "verified_seller") query = query.eq("seller_verified", true);
    if (safeSearch) {
      query = query.or(
        `display_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,username.ilike.%${safeSearch}%`
      );
    }

    const from = (page - 1) * PAGE_SIZE;
    const [profilesResult, authDirectoryResult, registeredResult, adminsResult, sellersResult, bannedResult] =
      await Promise.all([
        query
          .order("joined_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1),
        admin.auth.admin.listUsers({ page: 1, perPage: AUTH_DIRECTORY_LIMIT }),
        admin.from("profiles").select("id", { count: "exact", head: true }),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_seller", true),
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
      ]);

    if (profilesResult.error) {
      return NextResponse.json(
        { error: "Could not load the user directory." },
        { status: 500 }
      );
    }

    const profiles = profilesResult.data ?? [];
    const warnings: string[] = [];
    const authUsers = authDirectoryResult.data?.users ?? [];
    const authTotal =
      authDirectoryResult.data &&
      "total" in authDirectoryResult.data &&
      typeof authDirectoryResult.data.total === "number"
        ? authDirectoryResult.data.total
        : authUsers.length;
    const authById = new Map(authUsers.map((user) => [user.id, user]));

    if (authDirectoryResult.error) {
      warnings.push("Authentication status is temporarily unavailable.");
    } else {
      const missingIds = profiles
        .map((profile) => profile.id)
        .filter((id) => !authById.has(id));

      const missingUsers = await Promise.all(
        missingIds.map((id) => admin.auth.admin.getUserById(id))
      );
      for (const result of missingUsers) {
        if (result.data.user) authById.set(result.data.user.id, result.data.user);
      }
    }

    const { activation, warnings: activationWarnings } =
      await loadActivationByUser(
        admin,
        profiles.map((profile) => profile.id)
      );
    warnings.push(...activationWarnings);

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1_000;
    const confirmedUsers = authUsers.filter((user) =>
      Boolean(user.email_confirmed_at || user.phone_confirmed_at)
    ).length;
    const activeUsers30d = authUsers.filter(
      (user) =>
        user.last_sign_in_at &&
        new Date(user.last_sign_in_at).getTime() >= thirtyDaysAgo
    ).length;
    const pageStages = profiles.reduce<Record<ActivationStage, number>>(
      (counts, profile) => {
        counts[finalizeActivation(activation.get(profile.id)).stage] += 1;
        return counts;
      },
      { new: 0, engaged: 0, activated: 0, customer: 0 }
    );

    return NextResponse.json(
      {
        users: profiles.map((profile) => ({
          ...profile,
          auth: authDetails(authById.get(profile.id)),
          activation: finalizeActivation(activation.get(profile.id)),
        })),
        totalCount: profilesResult.count ?? 0,
        page,
        pageSize: PAGE_SIZE,
        summary: {
          registered: authDirectoryResult.error
            ? registeredResult.count ?? 0
            : authTotal,
          confirmed: confirmedUsers,
          active30d: activeUsers30d,
          admins: adminsResult.count ?? 0,
          sellers: sellersResult.count ?? 0,
          banned: bannedResult.count ?? 0,
          authCoverageComplete:
            !authDirectoryResult.error &&
            authTotal <= authUsers.length,
          pageStages,
        },
        warnings: [...new Set(warnings)],
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err) {
    return handleApiError(err, "api/admin/users");
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-users-write:${ip}`, RATE_LIMITS.write);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const originError = rejectUntrustedRequestOrigin(request);
    if (originError) return originError;

    const session = await requireAdminSession();
    if (session.error) return session.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { userId, isAdmin, sellerVerified } = body as {
      userId?: string;
      isAdmin?: boolean;
      sellerVerified?: boolean;
    };

    if (!userId) {
      return NextResponse.json({ error: "Missing userId." }, { status: 400 });
    }

    try {
      assertUuid(userId, "userId");
    } catch {
      return NextResponse.json(
        { error: "Invalid userId format." },
        { status: 400 }
      );
    }

    const updatePayload: {
      updated_at: string;
      is_admin?: boolean;
      is_seller?: boolean;
      seller_verified?: boolean;
    } = { updated_at: new Date().toISOString() };

    if (typeof isAdmin === "boolean") {
      if (session.user.id === userId && !isAdmin) {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 400 }
        );
      }
      updatePayload.is_admin = isAdmin;
    }

    if (typeof sellerVerified === "boolean") {
      updatePayload.seller_verified = sellerVerified;
      if (sellerVerified) updatePayload.is_seller = true;
    }

    if (Object.keys(updatePayload).length === 1) {
      return NextResponse.json(
        { error: "No supported admin updates were provided." },
        { status: 400 }
      );
    }

    const { data, error } = await createAdminClient()
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("id, is_admin, is_seller, seller_verified")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Could not update this user." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data });
  } catch (err) {
    return handleApiError(err, "api/admin/users");
  }
}
