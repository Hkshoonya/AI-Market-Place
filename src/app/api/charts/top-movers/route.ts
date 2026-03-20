import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { handleApiError } from "@/lib/api-error";
import { buildTopMoversPayload, type ModelSummaryRow, type SnapshotRow } from "./logic";

export const dynamic = "force-dynamic";
const SNAPSHOT_PAGE_SIZE = 1000;

/**
 * GET /api/charts/top-movers
 *
 * Returns models with the biggest rank changes (up and down)
 * by comparing today's snapshot with yesterday's.
 *
 * Query params:
 *   limit - number of movers in each direction (default 10)
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

  try {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const payload = await buildTopMoversPayload(
      {
        fetchSnapshotsForDate: (snapshotDate) =>
          fetchSnapshotsForDate(supabase, snapshotDate),
        fetchLatestSnapshotDate: (beforeDate) =>
          fetchLatestSnapshotDate(supabase, beforeDate),
        fetchModels: (modelIds) => fetchModels(supabase, modelIds),
      },
      { today, yesterday, limit }
    );

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    return handleApiError(err, "api/charts/top-movers");
  }
}

async function fetchSnapshotsForDate(
  supabase: ReturnType<typeof createClient<Database>>,
  snapshotDate: string
): Promise<SnapshotRow[]> {
  const rows: SnapshotRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("model_snapshots")
      .select("model_id, overall_rank, quality_score")
      .eq("snapshot_date", snapshotDate)
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < SNAPSHOT_PAGE_SIZE) break;
    from += SNAPSHOT_PAGE_SIZE;
  }

  return rows;
}

async function fetchLatestSnapshotDate(
  supabase: ReturnType<typeof createClient<Database>>,
  beforeDate?: string
): Promise<string | null> {
  let query = supabase
    .from("model_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false })
    .limit(1);

  if (beforeDate) {
    query = query.lt("snapshot_date", beforeDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data?.[0]?.snapshot_date ?? null;
}

async function fetchModels(
  supabase: ReturnType<typeof createClient<Database>>,
  modelIds: string[]
): Promise<ModelSummaryRow[]> {
  if (modelIds.length === 0) return [];

  const { data, error } = await supabase
    .from("models")
    .select("id, name, slug, provider, category")
    .in("id", modelIds);

  if (error) throw error;
  return data ?? [];
}
