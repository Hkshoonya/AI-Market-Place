import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

// GET /api/admin/data-sources — list all data sources
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-ds:${ip}`, RATE_LIMITS.public);
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
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("data_sources")
      .select("*")
      .order("tier", { ascending: true })
      .order("priority", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: syncJobs, error: syncJobsError } = await adminSupabase
      .from("sync_jobs")
      .select("source, status, error_message, metadata, completed_at, started_at")
      .order("started_at", { ascending: false })
      .limit(500);

    if (syncJobsError) {
      return NextResponse.json({ error: syncJobsError.message }, { status: 500 });
    }

    const latestSyncJobBySource = new Map<string, (typeof syncJobs)[number]>();
    for (const job of syncJobs ?? []) {
      if (!latestSyncJobBySource.has(job.source)) {
        latestSyncJobBySource.set(job.source, job);
      }
    }

    const enrichedData = (data ?? []).map((source) => ({
      ...source,
      latest_sync_job: latestSyncJobBySource.get(source.slug) ?? null,
    }));

    return NextResponse.json({ data: enrichedData });
  } catch (err) {
    return handleApiError(err, "api/admin/data-sources");
  }
}

// PATCH /api/admin/data-sources — toggle enable/disable
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-ds-write:${ip}`, RATE_LIMITS.write);
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
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const { id: idRaw, is_enabled } = body as { id: number | string; is_enabled: boolean };
    // data_sources.id is a number in the DB schema
    const id = typeof idRaw === "string" ? parseInt(idRaw, 10) : idRaw;

    if (!id || isNaN(id) || typeof is_enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing id or is_enabled" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("data_sources")
      .update({ is_enabled, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err, "api/admin/data-sources");
  }
}
