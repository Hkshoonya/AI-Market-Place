import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackCronRun } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HIGH_FREQUENCY_NEWS_SOURCES = [
  "open-llm-leaderboard",
  "bigcode-leaderboard",
  "artificial-analysis",
  "livebench",
] as const;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function deleteBatchByIds(
  supabase: ReturnType<typeof createAdminClient>,
  table: "model_news" | "cron_runs",
  ids: string[]
) {
  if (ids.length === 0) return 0;

  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) {
    throw new Error(`Failed deleting ${table}: ${error.message}`);
  }

  return ids.length;
}

async function deleteHighFrequencyNewsBatch(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
) {
  const { data, error } = await supabase
    .from("model_news")
    .select("id")
    .in("source", [...HIGH_FREQUENCY_NEWS_SOURCES])
    .lt("published_at", daysAgo(60))
    .order("published_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed selecting high-frequency model_news retention batch: ${error.message}`
    );
  }

  return deleteBatchByIds(
    supabase,
    "model_news",
    (data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string")
  );
}

async function deleteNonOfficialNewsBatch(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
) {
  const { data, error } = await supabase
    .from("model_news")
    .select("id")
    .not("source", "in", '("provider-blog","x-twitter")')
    .lt("published_at", daysAgo(180))
    .order("published_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed selecting non-official model_news retention batch: ${error.message}`
    );
  }

  return deleteBatchByIds(
    supabase,
    "model_news",
    (data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string")
  );
}

async function deleteOfficialNewsBatch(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
) {
  const { data, error } = await supabase
    .from("model_news")
    .select("id")
    .in("source", ["provider-blog", "x-twitter"])
    .lt("published_at", daysAgo(365))
    .order("published_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed selecting official model_news retention batch: ${error.message}`
    );
  }

  return deleteBatchByIds(
    supabase,
    "model_news",
    (data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string")
  );
}

async function deleteCronRunsBatch(
  supabase: ReturnType<typeof createAdminClient>,
  limit: number
) {
  const { data, error } = await supabase
    .from("cron_runs")
    .select("id")
    .lt("created_at", daysAgo(30))
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed selecting cron_runs retention batch: ${error.message}`);
  }

  return deleteBatchByIds(
    supabase,
    "cron_runs",
    (data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string")
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await trackCronRun("maintenance-retention");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.max(
      100,
      Math.min(Number(searchParams.get("limit") ?? 1500), 5000)
    );
    const perPolicyLimit = Math.max(50, Math.floor(limit / 4));

    const highFrequencyNewsDeleted = await deleteHighFrequencyNewsBatch(
      supabase,
      perPolicyLimit
    );
    const nonOfficialNewsDeleted = await deleteNonOfficialNewsBatch(
      supabase,
      perPolicyLimit
    );
    const officialNewsDeleted = await deleteOfficialNewsBatch(
      supabase,
      perPolicyLimit
    );
    const cronRunsDeleted = await deleteCronRunsBatch(supabase, perPolicyLimit);

    return tracker.complete({
      highFrequencyNewsDeleted,
      nonOfficialNewsDeleted,
      officialNewsDeleted,
      cronRunsDeleted,
      limit,
    });
  } catch (error) {
    return tracker.fail(error);
  }
}
