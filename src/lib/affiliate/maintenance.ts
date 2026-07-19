import "server-only";

import type { TypedSupabaseClient } from "@/types/database";
import { checkAffiliateDestination } from "./health";

async function syncPlatformAffiliateFlag(
  supabase: TypedSupabaseClient,
  platformId: string
) {
  const now = new Date().toISOString();
  const { count, error } = await supabase
    .from("affiliate_links")
    .select("id", { count: "exact", head: true })
    .eq("platform_id", platformId)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("deployment_platforms")
    .update({
      has_affiliate: (count ?? 0) > 0,
      affiliate_url: null,
      affiliate_tag: null,
      updated_at: now,
    })
    .eq("id", platformId);
  if (updateError) throw updateError;
}

export async function maintainAffiliateLinks(input: {
  supabase: TypedSupabaseClient;
  limit?: number;
  failureThreshold?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const failureThreshold = Math.min(Math.max(input.failureThreshold ?? 3, 2), 10);
  const { data, error } = await input.supabase
    .from("affiliate_links")
    .select("id, platform_id, destination_url, consecutive_failures, status")
    .in("status", ["active", "invalid"])
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;

  const results = {
    checked: 0,
    healthy: 0,
    failed: 0,
    invalidated: 0,
    recovered: 0,
    errors: [] as string[],
  };
  const touchedPlatforms = new Set<string>();

  for (let index = 0; index < (data ?? []).length; index += 5) {
    const batch = (data ?? []).slice(index, index + 5);
    await Promise.all(
      batch.map(async (link) => {
        try {
          const health = await checkAffiliateDestination(link.destination_url, {
            timeoutMs: input.timeoutMs,
            signal: input.signal,
          });
          const failures = health.ok ? 0 : (link.consecutive_failures ?? 0) + 1;
          const nextStatus = health.ok
            ? link.status === "invalid"
              ? "draft"
              : "active"
            : failures >= failureThreshold
              ? "invalid"
              : link.status;

          const { error: updateError } = await input.supabase
            .from("affiliate_links")
            .update({
              status: nextStatus,
              last_checked_at: new Date().toISOString(),
              last_check_status: health.status,
              last_http_status: health.httpStatus,
              consecutive_failures: failures,
              last_error: health.error,
            })
            .eq("id", link.id);
          if (updateError) throw updateError;

          results.checked += 1;
          if (health.ok) results.healthy += 1;
          else results.failed += 1;
          if (nextStatus === "invalid" && link.status !== "invalid") results.invalidated += 1;
          if (health.ok && link.status === "invalid") results.recovered += 1;
          touchedPlatforms.add(link.platform_id);
        } catch (error) {
          results.errors.push(
            error instanceof Error ? error.message.slice(0, 300) : "Affiliate check failed"
          );
        }
      })
    );
  }

  for (const platformId of touchedPlatforms) {
    await syncPlatformAffiliateFlag(input.supabase, platformId);
  }

  return results;
}
