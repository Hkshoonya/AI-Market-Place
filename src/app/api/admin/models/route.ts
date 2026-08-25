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
import type { ModelStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const MODEL_STATUSES = new Set<ModelStatus>([
  "active",
  "preview",
  "beta",
  "deprecated",
  "archived",
]);

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-models:${ip}`, RATE_LIMITS.api);
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
    const rawStatus = searchParams.get("status") ?? "all";
    const status = MODEL_STATUSES.has(rawStatus as ModelStatus)
      ? (rawStatus as ModelStatus)
      : null;
    const search = sanitizeFilterValue(searchParams.get("search") ?? "");

    let query = createAdminClient()
      .from("models")
      .select(
        "id, slug, name, provider, category, status, overall_rank, quality_score, hf_downloads, created_at, is_open_weights",
        { count: "exact" }
      );

    if (status) query = query.eq("status", status);
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,provider.ilike.%${search}%`
      );
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json(
        { error: "Could not load models." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      models: data ?? [],
      totalCount: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/models");
  }
}

export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-models-write:${ip}`, RATE_LIMITS.write);
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

    const { id, status } = body as { id?: string; status?: string };
    if (!id) {
      return NextResponse.json({ error: "Missing model id." }, { status: 400 });
    }
    try {
      assertUuid(id, "id");
    } catch {
      return NextResponse.json({ error: "Invalid model id." }, { status: 400 });
    }

    if (!MODEL_STATUSES.has(status as ModelStatus)) {
      return NextResponse.json({ error: "Invalid model status." }, { status: 400 });
    }

    const { data, error } = await createAdminClient()
      .from("models")
      .update({
        status: status as ModelStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not update this model." },
        { status: error?.code === "PGRST116" ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true, model: data });
  } catch (err) {
    return handleApiError(err, "api/admin/models");
  }
}
