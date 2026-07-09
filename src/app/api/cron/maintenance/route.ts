import type { SupabaseClient } from "@supabase/supabase-js";
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
const DELETE_CHUNK_SIZE = 400;

type RetentionFilter =
  | { operator: "eq"; column: string; value: string }
  | { operator: "in"; column: string; values: readonly string[] }
  | { operator: "not-in"; column: string; values: readonly string[] };

type RetentionPolicy = {
  key: string;
  table: string;
  dateColumn: string;
  retentionDays: number;
  weight: number;
  filters?: RetentionFilter[];
};

const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    key: "highFrequencyNewsDeleted",
    table: "model_news",
    dateColumn: "published_at",
    retentionDays: 60,
    weight: 4,
    filters: [
      { operator: "in", column: "source", values: HIGH_FREQUENCY_NEWS_SOURCES },
    ],
  },
  {
    key: "nonOfficialNewsDeleted",
    table: "model_news",
    dateColumn: "published_at",
    retentionDays: 180,
    weight: 2,
    filters: [
      {
        operator: "not-in",
        column: "source",
        values: ["provider-blog", "x-twitter"],
      },
    ],
  },
  {
    key: "officialNewsDeleted",
    table: "model_news",
    dateColumn: "published_at",
    retentionDays: 365,
    weight: 1,
    filters: [
      {
        operator: "in",
        column: "source",
        values: ["provider-blog", "x-twitter"],
      },
    ],
  },
  {
    key: "cronRunsDeleted",
    table: "cron_runs",
    dateColumn: "created_at",
    retentionDays: 14,
    weight: 3,
  },
  {
    key: "systemInfoLogsDeleted",
    table: "system_logs",
    dateColumn: "created_at",
    retentionDays: 7,
    weight: 8,
    filters: [{ operator: "eq", column: "level", value: "info" }],
  },
  {
    key: "systemWarningLogsDeleted",
    table: "system_logs",
    dateColumn: "created_at",
    retentionDays: 30,
    weight: 2,
    filters: [{ operator: "in", column: "level", values: ["warn", "error"] }],
  },
  {
    key: "agentLogsDeleted",
    table: "agent_logs",
    dateColumn: "created_at",
    retentionDays: 14,
    weight: 4,
  },
  {
    key: "terminalAgentTasksDeleted",
    table: "agent_tasks",
    dateColumn: "created_at",
    retentionDays: 30,
    weight: 2,
    filters: [
      {
        operator: "in",
        column: "status",
        values: ["completed", "failed", "cancelled"],
      },
    ],
  },
  {
    key: "syncJobsDeleted",
    table: "sync_jobs",
    dateColumn: "created_at",
    retentionDays: 30,
    weight: 3,
  },
  {
    key: "paymentWebhookEventsDeleted",
    table: "payment_webhook_events",
    dateColumn: "created_at",
    retentionDays: 90,
    weight: 1,
  },
  {
    key: "modelSnapshotsDeleted",
    table: "model_snapshots",
    dateColumn: "snapshot_date",
    retentionDays: 365,
    weight: 1,
  },
];

const TOTAL_POLICY_WEIGHT = RETENTION_POLICIES.reduce(
  (total, policy) => total + policy.weight,
  0
);

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function formatPostgrestList(values: readonly string[]) {
  return `(${values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",")})`;
}

async function deleteBatchByIds(
  supabase: SupabaseClient,
  table: string,
  ids: Array<string | number>
) {
  for (let index = 0; index < ids.length; index += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + DELETE_CHUNK_SIZE);
    const { error } = await supabase.from(table).delete().in("id", chunk);
    if (error) {
      throw new Error(`Failed deleting ${table}: ${error.message}`);
    }
  }

  return ids.length;
}

async function applyRetentionPolicy(
  supabase: SupabaseClient,
  policy: RetentionPolicy,
  limit: number
) {
  let query = supabase.from(policy.table).select("id");

  for (const filter of policy.filters ?? []) {
    if (filter.operator === "eq") {
      query = query.eq(filter.column, filter.value);
    } else if (filter.operator === "in") {
      query = query.in(filter.column, [...filter.values]);
    } else {
      query = query.not(filter.column, "in", formatPostgrestList(filter.values));
    }
  }

  const { data, error } = await query
    .lt(policy.dateColumn, daysAgo(policy.retentionDays))
    .order(policy.dateColumn, { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed selecting ${policy.key}: ${error.message}`);
  }

  const ids = ((data ?? []) as Array<{ id?: unknown }>)
    .map((row) => row.id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number");

  return deleteBatchByIds(supabase, policy.table, ids);
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
    const supabase = createAdminClient() as unknown as SupabaseClient;
    const { searchParams } = new URL(request.url);
    const limit = Math.max(
      500,
      Math.min(Number(searchParams.get("limit") ?? 5000), 20_000)
    );
    const deleted: Record<string, number> = {};

    for (const policy of RETENTION_POLICIES) {
      const policyLimit = Math.max(
        50,
        Math.floor((limit * policy.weight) / TOTAL_POLICY_WEIGHT)
      );
      deleted[policy.key] = await applyRetentionPolicy(supabase, policy, policyLimit);
    }

    return tracker.complete({
      ...deleted,
      limit,
    });
  } catch (error) {
    return tracker.fail(error);
  }
}
