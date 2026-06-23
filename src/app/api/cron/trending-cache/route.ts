import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { trackCronRun } from "@/lib/cron-tracker";
import {
  buildTrendingPayload,
  writeTrendingCache,
} from "@/app/api/trending/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseLimits(value: string | null) {
  const limits = (value ?? "8,10")
    .split(",")
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((limit) => Number.isFinite(limit) && limit > 0 && limit <= 50);

  return limits.length > 0 ? Array.from(new Set(limits)) : [8, 10];
}

function parseCategories(value: string | null) {
  const categories = (value ?? "all")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item === "all" ? null : item));

  return categories.length > 0 ? Array.from(new Set(categories)) : [null];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tracker = await trackCronRun("trending-cache");
  if (tracker.shouldSkip) {
    return tracker.skip();
  }

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const limits = parseLimits(searchParams.get("limits"));
    const categories = parseCategories(searchParams.get("categories"));
    const refreshed: Array<{ limit: number; category: string | null }> = [];

    for (const limit of limits) {
      for (const category of categories) {
        const payload = await buildTrendingPayload(supabase, { limit, category });
        await writeTrendingCache(supabase, { limit, category, payload });
        refreshed.push({ limit, category });
      }
    }

    return tracker.complete({
      refreshed,
      refreshedCount: refreshed.length,
    });
  } catch (error) {
    return tracker.fail(error);
  }
}
