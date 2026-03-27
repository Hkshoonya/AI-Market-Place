import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

const CRON_HEALTH_LOOKBACK_HOURS = 24;

function formatErrorMessage(value: string | null | undefined) {
  const text = value?.trim();
  if (!text) {
    return "Unknown failure";
  }

  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-cron:${ip}`, RATE_LIMITS.public);
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

    const cutoff = new Date(
      Date.now() - CRON_HEALTH_LOOKBACK_HOURS * 60 * 60 * 1000
    ).toISOString();

    const [{ data: recentRuns, error: recentRunsError }, { count: failedCount, error: failedCountError }] =
      await Promise.all([
        supabase
          .from("cron_runs")
          .select("id, job_name, status, error_message, started_at, finished_at, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("cron_runs")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", cutoff),
      ]);

    if (recentRunsError) {
      return NextResponse.json({ error: recentRunsError.message }, { status: 500 });
    }
    if (failedCountError) {
      return NextResponse.json({ error: failedCountError.message }, { status: 500 });
    }

    const runs = recentRuns ?? [];
    const recentFailingRuns = runs
      .filter((run) => run.status === "failed")
      .slice(0, 10)
      .map((run) => ({
        ...run,
        error_message: formatErrorMessage(run.error_message),
      }));

    return NextResponse.json({
      summary: {
        recentRuns: runs.length,
        failedRuns24h: failedCount ?? 0,
        runningRuns: runs.filter((run) => run.status === "running").length,
        lastRunAt: runs[0]?.started_at ?? runs[0]?.created_at ?? null,
      },
      recentFailingRuns,
    });
  } catch (err) {
    return handleApiError(err, "api/admin/cron");
  }
}
