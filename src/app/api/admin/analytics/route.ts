import { NextRequest, NextResponse } from "next/server";

import { handleApiError } from "@/lib/api-error";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { CATEGORIES } from "@/lib/constants/categories";
import {
  getClientIp,
  rateLimit,
  RATE_LIMITS,
  rateLimitHeaders,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface AnalyticsModelRow {
  category: string | null;
  provider: string;
  is_open_weights: boolean;
}

async function loadAllActiveModelDimensions(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ data: AnalyticsModelRow[]; error: { message: string } | null }> {
  const pageSize = 1_000;
  const rows: AnalyticsModelRow[] = [];
  let totalCount: number | null = null;

  for (let from = 0; totalCount === null || from < totalCount; from += pageSize) {
    const result = await admin
      .from("models")
      .select("category, provider, is_open_weights", { count: "exact" })
      .eq("status", "active")
      .range(from, from + pageSize - 1);

    if (result.error) return { data: [], error: result.error };

    const page = result.data ?? [];
    rows.push(...page);
    totalCount = result.count ?? rows.length;

    if (page.length < pageSize) break;
  }

  return { data: rows, error: null };
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-analytics:${ip}`, RATE_LIMITS.api);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const session = await requireAdminSession();
    if (session.error) return session.error;

    const admin = createAdminClient();
    const [allModelsResult, topDownloadedResult, topRatedResult] = await Promise.all([
        loadAllActiveModelDimensions(admin),
        admin
          .from("models")
          .select("name, provider, hf_downloads")
          .eq("status", "active")
          .order("hf_downloads", { ascending: false, nullsFirst: false })
          .limit(10),
        admin
          .from("models")
          .select("name, provider, quality_score")
          .eq("status", "active")
          .not("quality_score", "is", null)
          .order("quality_score", { ascending: false })
          .limit(10),
      ]);

    if (
      allModelsResult.error ||
      topDownloadedResult.error ||
      topRatedResult.error
    ) {
      return NextResponse.json(
        { error: "Could not load platform analytics." },
        { status: 500 }
      );
    }

    const categoryCounts = new Map<string, number>();
    const providerCounts = new Map<string, number>();
    let open = 0;

    for (const model of allModelsResult.data ?? []) {
      const category = model.category || "uncategorized";
      categoryCounts.set(
        category,
        (categoryCounts.get(category) ?? 0) + 1
      );
      providerCounts.set(
        model.provider,
        (providerCounts.get(model.provider) ?? 0) + 1
      );
      if (model.is_open_weights === true) open += 1;
    }

    const totalModels = allModelsResult.data?.length ?? 0;
    const categoryBreakdown = [...categoryCounts.entries()]
      .map(([category, count]) => {
        const config = CATEGORIES.find((item) => item.slug === category);
        return {
          category,
          count,
          label: config?.label ?? category,
          color: config?.color ?? "#666666",
        };
      })
      .sort((left, right) => right.count - left.count);
    const providerBreakdown = [...providerCounts.entries()]
      .map(([provider, count]) => ({ provider, count }))
      .sort((left, right) => right.count - left.count);

    return NextResponse.json({
      categoryBreakdown,
      providerBreakdown,
      topDownloaded: (topDownloadedResult.data ?? []).map((model) => ({
        ...model,
        hf_downloads: Number(model.hf_downloads) || 0,
      })),
      topRated: (topRatedResult.data ?? []).map((model) => ({
        ...model,
        quality_score: Number(model.quality_score) || 0,
      })),
      openVsClosed: { open, closed: totalModels - open },
    });
  } catch (err) {
    return handleApiError(err, "api/admin/analytics");
  }
}
