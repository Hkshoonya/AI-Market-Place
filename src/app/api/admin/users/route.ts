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
import { assertUuid, sanitizeFilterValue } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type AdminSessionResult =
  | { user: { id: string }; error?: undefined }
  | { user?: undefined; error: NextResponse };

async function requireAdminSession(): Promise<AdminSessionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } satisfies AdminSessionResult;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) } satisfies AdminSessionResult;
  }

  return { user: { id: user.id } } satisfies AdminSessionResult;
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
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const role = searchParams.get("role") ?? "all";
    const rawSearch = searchParams.get("search") ?? "";
    const safeSearch = sanitizeFilterValue(rawSearch);

    let query = createAdminClient()
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url, is_admin, is_seller, seller_verified, is_banned, joined_at, total_sales, reputation_score, seller_bio, seller_website, seller_rating, bio, email, created_at, updated_at",
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
    const { data, count, error } = await query
      .order("joined_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      users: data ?? [],
      totalCount: count ?? 0,
    });
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
    const auth = await requireAdminSession();
    if (auth.error) return auth.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const {
      userId,
      isAdmin,
      sellerVerified,
    } = body as {
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
      return NextResponse.json({ error: "Invalid userId format." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof isAdmin === "boolean") {
      if (auth.user.id === userId && !isAdmin) {
        return NextResponse.json(
          { error: "You cannot remove your own admin access." },
          { status: 400 }
        );
      }
      updatePayload.is_admin = isAdmin;
    }

    if (typeof sellerVerified === "boolean") {
      updatePayload.seller_verified = sellerVerified;
    }

    if (Object.keys(updatePayload).length === 1) {
      return NextResponse.json(
        { error: "No supported admin updates were provided." },
        { status: 400 }
      );
    }

    const { error } = await createAdminClient()
      .from("profiles")
      .update(updatePayload)
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "api/admin/users");
  }
}
