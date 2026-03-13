/**
 * Admin Data Integrity Endpoint
 *
 * GET /api/admin/data-integrity
 *
 * Admin-session-authenticated endpoint that runs the data integrity verification
 * engine and returns a full DataIntegrityReport including per-source quality scores,
 * table coverage, and freshness status.
 *
 * Auth:
 *   - Uses createClient() for session auth check (getUser + profiles.is_admin)
 *   - Uses createAdminClient() for data queries (bypasses RLS)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api-error";
import { verifyDataIntegrity } from "@/lib/data-integrity";
import {
  rateLimit,
  RATE_LIMITS,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const SourceQualityScoreSchema = z.object({
  slug: z.string(),
  name: z.string(),
  qualityScore: z.number().min(0).max(100),
  completeness: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  trend: z.number().min(0).max(1),
  recordCount: z.number(),
  lastSyncAt: z.string().nullable(),
  syncIntervalHours: z.number(),
  staleSince: z.string().nullable(),
  isStale: z.boolean(),
});

const TableCoverageSchema = z.object({
  table: z.string(),
  rowCount: z.number(),
  isEmpty: z.boolean(),
  responsibleAdapters: z.array(z.string()),
});

const DataIntegrityReportSchema = z.object({
  checkedAt: z.string(),
  summary: z.object({
    totalSources: z.number(),
    healthySources: z.number(),
    staleSources: z.number(),
    emptyTables: z.number(),
    averageQualityScore: z.number(),
  }),
  qualityScores: z.array(SourceQualityScoreSchema),
  tableCoverage: z.array(TableCoverageSchema),
  freshness: z.object({
    staleSourceCount: z.number(),
    staleSources: z.array(
      z.object({
        slug: z.string(),
        name: z.string(),
        lastSyncAt: z.string().nullable(),
        expectedIntervalHours: z.number(),
        overdueBy: z.string(),
      })
    ),
  }),
  modelEvidence: z.object({
    totalModels: z.number(),
    lowBiasRiskModels: z.number(),
    mediumBiasRiskModels: z.number(),
    highBiasRiskModels: z.number(),
    corroboratedModels: z.number(),
    averageIndependentQualitySources: z.number(),
    averageDistinctSources: z.number(),
  }),
});

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-data-integrity:${ip}`, RATE_LIMITS.public);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    // ── Admin session auth ──────────────────────────────────────────────────
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

    // ── Data queries via admin client (bypasses RLS) ──────────────────────────
    const adminSupabase = createAdminClient();

    const report = await verifyDataIntegrity(adminSupabase);

    // Validate report shape before returning
    const validated = DataIntegrityReportSchema.parse(report);

    return NextResponse.json(validated);
  } catch (err) {
    return handleApiError(err, "admin/data-integrity");
  }
}
