/**
 * Pipeline Health Tracker
 *
 * Tracks data source sync health, detects stale sources,
 * and provides coverage reporting.
 */

import { createClient } from "@supabase/supabase-js";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Record a successful sync for a source */
export async function recordSyncSuccess(sourceSlug: string): Promise<void> {
  const sb = createServiceClient();
  await sb.from("pipeline_health").upsert({
    source_slug: sourceSlug,
    last_success_at: new Date().toISOString(),
    consecutive_failures: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_slug" });
}

/** Record a failed sync for a source. Returns the new consecutive failure count. */
export async function recordSyncFailure(sourceSlug: string): Promise<number> {
  const sb = createServiceClient();
  const { data: existing } = await sb
    .from("pipeline_health")
    .select("consecutive_failures")
    .eq("source_slug", sourceSlug)
    .single();

  const failures = (existing?.consecutive_failures ?? 0) + 1;

  await sb.from("pipeline_health").upsert({
    source_slug: sourceSlug,
    consecutive_failures: failures,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_slug" });

  return failures;
}

/** Get count of stale sources (not synced within 2x expected interval) */
export async function getStaleSourceCount(): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("pipeline_health")
    .select("source_slug, last_success_at, expected_interval_hours");

  if (!data) return 0;

  const now = Date.now();
  let staleCount = 0;
  for (const row of data) {
    if (!row.last_success_at) { staleCount++; continue; }
    const lastSync = new Date(row.last_success_at).getTime();
    const maxAge = (row.expected_interval_hours ?? 6) * 2 * 60 * 60 * 1000;
    if (now - lastSync > maxAge) staleCount++;
  }

  return staleCount;
}

/** Build signal coverage map for a model */
export function buildSignalCoverage(signals: {
  hasBenchmarks: boolean;
  hasELO: boolean;
  hasDownloads: boolean;
  hasLikes: boolean;
  hasStars: boolean;
  hasNews: boolean;
  hasPricing: boolean;
}): Record<string, boolean> {
  return {
    benchmarks: signals.hasBenchmarks,
    elo: signals.hasELO,
    downloads: signals.hasDownloads,
    likes: signals.hasLikes,
    stars: signals.hasStars,
    news: signals.hasNews,
    pricing: signals.hasPricing,
  };
}
